package main

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/IBM/sarama"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/feature/s3/manager"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"
	"github.com/google/uuid"
	_ "github.com/joho/godotenv/autoload"
	"github.com/robfig/cron/v3"
	"golang.org/x/time/rate"
)

type l = []any
type m = map[string]any
type BucketBasics struct {
	S3Client *s3.Client
}
type Clients struct {
	SekaiClient   *SekaiClient
	S3Client      *s3.Client
	KafkaProducer *sarama.SyncProducer
	updatingMutex *sync.Mutex
}

func (clients *Clients) UploadLargeObject(ctx context.Context, bucketName string, objectKey string, largeObject []byte, contentType *string, hash string) (bool, error) {
	largeBuffer := bytes.NewReader(largeObject)
	var partMiBs int64 = 10
	uploader := manager.NewUploader(clients.S3Client, func(u *manager.Uploader) {
		u.PartSize = partMiBs * 1024 * 1024
	})
	_, err := uploader.Upload(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(bucketName),
		Key:         aws.String(objectKey),
		Body:        largeBuffer,
		ContentType: contentType,
		ACL:         types.ObjectCannedACLPublicRead,
		Metadata: map[string]string{
			"hash": hash,
		},
	})
	if err != nil {
		return false, err
	} else {
		err = s3.NewObjectExistsWaiter(clients.S3Client).Wait(
			ctx, &s3.HeadObjectInput{Bucket: aws.String(bucketName), Key: aws.String(objectKey)}, time.Minute)
		if err != nil {
			return false, err
		}
	}

	return true, nil
}

func GetKeyValueObjectKey(objectKey string) string {
	return fmt.Sprintf("%v/%v.json", os.Getenv("S3_PATH"), objectKey)
}

func GetAssetbundleObjectKey(objectKey string) string {
	return fmt.Sprintf("%v/assetbundle/%v.unity3d", os.Getenv("S3_PATH"), objectKey)
}

func (clients *Clients) GetLargeObjectHash(ctx context.Context, bucketName string, objectKey string) (string, error) {
	headObject, err := clients.S3Client.HeadObject(ctx, &s3.HeadObjectInput{
		Bucket: aws.String(bucketName),
		Key:    aws.String(objectKey),
	})

	if err != nil {
		return "", err
	}
	return headObject.Metadata["hash"], nil
}

func (clients *Clients) UploadLargeObjectIfNotExists(ctx context.Context, bucketName string, objectKey string, largeObject []byte, contentType *string, hash string) (bool, error) {
	if hash == "" {
		hasher := sha256.New()
		hasher.Write(largeObject)
		hash = hex.EncodeToString(hasher.Sum(nil))
	}

	remoteHash, _ := clients.GetLargeObjectHash(ctx, bucketName, objectKey)

	if remoteHash == hash {
		return false, nil
	}

	log.Printf("Updating %v", objectKey)
	return clients.UploadLargeObject(ctx, bucketName, objectKey, largeObject, contentType, hash)
}

type Message struct {
	Bucket string
	Key    string
}

func (clients *Clients) NotifyKafka(key string) {
	if clients.KafkaProducer == nil {
		return
	}

	message := Message{
		Bucket: os.Getenv("S3_BUCKET"),
		Key:    key,
	}

	marshaled, err := json.Marshal(message)
	assert(err)

	(*clients.KafkaProducer).SendMessage(&sarama.ProducerMessage{
		Topic: "sekai:update",
		Value: sarama.ByteEncoder(marshaled),
	})
}

func (clients *Clients) UploadKeyValueIfNotExists(ctx context.Context, key string, value any) (bool, error) {
	objectKey := GetKeyValueObjectKey(key)

	object, err := json.MarshalIndent(value, "", "  ")
	if err != nil {
		return false, err
	}
	u, err := clients.UploadLargeObjectIfNotExists(context.TODO(), os.Getenv("S3_BUCKET"), objectKey, object, aws.String("application/json"), "")

	if u {
		clients.NotifyKafka(objectKey)
	}

	return u, err
}

func (clients *Clients) UploadAssetbundleIfNotExists(ctx context.Context, key string, value []byte) (bool, error) {
	objectKey := GetAssetbundleObjectKey(key)

	u, err := clients.UploadLargeObjectIfNotExists(context.TODO(), os.Getenv("S3_BUCKET"), objectKey, value, aws.String("application/octet-stream"), "")

	if u {
		clients.NotifyKafka(objectKey)
	}

	return u, err
}

func (clients *Clients) QueryUpdates() {
	if !clients.updatingMutex.TryLock() {
		return
	}
	defer clients.updatingMutex.Unlock()

	log.Printf("Querying updates")
	clients.SekaiClient.update()

	versions := clients.SekaiClient.Request("GET", fmt.Sprintf("https://game-version.sekai.colorfulpalette.org/%v/%v", clients.SekaiClient.AppVersion["appVersion"], clients.SekaiClient.AppVersion["appHash"]), nil)

	body := clients.SekaiClient.Request("PUT", fmt.Sprintf("https://%v/api/user/%v/auth?refreshUpdatedResources=False", versions["domain"], clients.SekaiClient.UserId), m{
		"credential": clients.SekaiClient.Credential,
	})

	for k, v := range body {
		if v, ok := v.(string); ok {
			clients.SekaiClient.AppVersion[k] = v
		}
	}
	clients.SekaiClient.SessionToken = body["sessionToken"].(string)

	update := false

	for _, p := range body["suiteMasterSplitPath"].(l) {
		if p, ok := p.(string); ok {
			for k, v := range clients.SekaiClient.Request("GET", fmt.Sprintf("https://%v/api/%v", versions["domain"], p), nil) {
				u, _ := clients.UploadKeyValueIfNotExists(context.TODO(), k, v)
				update = update || u
			}
		}
	}

	assetBundleInfo := clients.SekaiClient.Request("GET", fmt.Sprintf("https://%v-%v-assetbundle-info.sekai.colorfulpalette.org/api/version/%v/os/%v", versions["profile"], versions["assetbundleHostHash"], clients.SekaiClient.AppVersion["assetVersion"], strings.ToLower("iOS")), nil)
	u, _ := clients.UploadKeyValueIfNotExists(context.TODO(), "assetbundleInfo", assetBundleInfo)
	if u {
		update = true

		for k, v := range assetBundleInfo["bundles"].(m) {
			remoteHash, _ := clients.GetLargeObjectHash(context.TODO(), os.Getenv("S3_BUCKET"), GetAssetbundleObjectKey(k))

			if remoteHash == clients.SekaiClient.AppVersion["assetHash"] {
				continue
			}

			body := clients.SekaiClient.RequestDeobfuscate("GET", fmt.Sprintf("https://%v-%v-assetbundle.sekai.colorfulpalette.org/%v/%v/%v/%v", versions["profile"], versions["assetbundleHostHash"], clients.SekaiClient.AppVersion["assetVersion"], clients.SekaiClient.AppVersion["assetHash"], strings.ToLower("iOS"), v.(m)["bundleName"]))
			clients.UploadAssetbundleIfNotExists(context.TODO(), k, body)
		}
	}

	if !update {
		return
	}

	log.Printf("Found updates")
}

func StartKafkaProducer() (*sarama.Client, *sarama.SyncProducer, error) {
	kafkaBroker := os.Getenv("KAFKA_BROKER")
	if kafkaBroker == "" {
		return nil, nil, nil
	}

	saramaConfig := sarama.NewConfig()
	saramaConfig.Version = sarama.V2_1_0_0
	kafkaClient, err := sarama.NewClient([]string{kafkaBroker}, saramaConfig)
	if err != nil {
		return nil, nil, err
	}
	defer kafkaClient.Close()

	kafkaAdmin, err := sarama.NewClusterAdminFromClient(kafkaClient)
	if err != nil {
		return nil, nil, err
	}

	kafkaAdmin.CreateTopic("sekai:update", &sarama.TopicDetail{NumPartitions: 1, ReplicationFactor: 1}, false)

	kafkaProducer, err := sarama.NewSyncProducerFromClient(kafkaClient)
	if err != nil {
		panic(err)
	}
	return &kafkaClient, &kafkaProducer, nil
}

func Close(kafkaClient *sarama.Client) {
	if kafkaClient != nil {
		(*kafkaClient).Close()
	}
}

func main() {
	kafkaClient, kafkaProducer, err := StartKafkaProducer()
	if err != nil {
		panic(err)
	}
	defer Close(kafkaClient)

	clients := &Clients{
		SekaiClient: &SekaiClient{
			Config: &Config{
				AppVersion: make(map[string]string),

				Wg: &sync.WaitGroup{},
				Rl: rate.NewLimiter(64, 64),

				Crypt: &Crypt{
					key: []byte(os.Getenv("PJSEKAI_KEY")),
					iv:  []byte(os.Getenv("PJSEKAI_IV")),
					jwt: []byte(os.Getenv("PJSEKAI_JWT")),
				},
				Client: &http.Client{
					Timeout: 60 * time.Second,
					Transport: &http.Transport{
						MaxIdleConns:        64,
						MaxIdleConnsPerHost: 64,
						IdleConnTimeout:     60 * time.Second,
					},
				},
			},
			Data: make(m),

			InstallId: uuid.NewString(),
			Kc:        uuid.NewString(),
		},
		S3Client: s3.NewFromConfig(aws.Config{
			Region:       "us-east-1",
			Credentials:  credentials.NewStaticCredentialsProvider(os.Getenv("S3_KEY"), os.Getenv("S3_SECRET"), ""),
			BaseEndpoint: aws.String(os.Getenv("S3_ENDPOINT")),
		}), KafkaProducer: kafkaProducer, updatingMutex: &sync.Mutex{}}

	clients.SekaiClient.Request("POST", "https://issue.sekai.colorfulpalette.org/api/signature", nil)
	clients.SekaiClient.update()

	body := clients.SekaiClient.Request("POST", "https://production-game-api.sekai.colorfulpalette.org/api/user", m{
		"platform":        "iOS",
		"deviceModel":     "iPad7,5",
		"operatingSystem": "iPadOS 17.0",
	})
	clients.SekaiClient.UserId = body["userRegistration"].(m)["userId"]
	clients.SekaiClient.Credential = body["credential"].(string)

	clients.SekaiClient.Request("POST", fmt.Sprintf("https://production-game-api.sekai.colorfulpalette.org/api/user/%v/rule-agreement", clients.SekaiClient.UserId), m{
		"userId":     IdNumber(0),
		"credential": clients.SekaiClient.Credential,
	})

	c := cron.New()
	c.AddFunc("* * * * *", clients.QueryUpdates)
	c.Start()

	select {}
}
