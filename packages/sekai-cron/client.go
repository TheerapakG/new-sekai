package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"runtime/debug"
	"sync"

	"github.com/google/uuid"
	"github.com/vmihailenco/msgpack/v5"
	"golang.org/x/time/rate"
)

func assert(err error) {
	if err != nil {
		log.Println(err)
		debug.PrintStack()
		panic(err)
	}
}

type HTTPError struct {
	StatusCode int
}

func (e HTTPError) Error() string {
	return fmt.Sprintf("HTTP error %v", e.StatusCode)
}

type TooManyRequests HTTPError

func (e TooManyRequests) Error() string {
	return "too many requests: " + HTTPError(e).Error()
}

type ServerMaintenance HTTPError

func (e ServerMaintenance) Error() string {
	return "maintenance: " + HTTPError(e).Error()
}

type AuthError HTTPError

func (e AuthError) Error() string {
	return "auth error: " + HTTPError(e).Error()
}

func Deobfuscate(obfuscated []byte) []byte {
	ret := make([]byte, len(obfuscated))
	copy(ret, obfuscated)
	for i := 0; i < min(132, len(ret)); i++ {
		if (i+4)%8 < 5 {
			ret[i] ^= 0xFF
		}
	}
	return ret
}

type IdNumber any

type SekaiClient struct {
	*Config

	UserId       IdNumber
	Credential   string
	SessionToken string
	Data         m

	InstallId string
	Kc        string
	Cookie    string
}

type Config struct {
	AppVersion map[string]string

	Wg *sync.WaitGroup
	Rl *rate.Limiter

	*Crypt
	*http.Client
}

func (client *SekaiClient) Request(method string, url string, body m) m {
	// encrypt the data
	var data []byte
	var err error
	if body == nil {
		if method != "GET" {
			data = client.encrypt([]byte{})
		}
	} else {
		data, err = msgpack.Marshal(body)
		assert(err)
		data = client.encrypt(data)
	}

	// create the request
	req, err := http.NewRequest(method, url, bytes.NewBuffer(data))
	assert(err)

	// make headers
	req.Header.Add("accept", "application/octet-stream")
	req.Header.Add("content-type", "application/octet-stream")

	req.Header.Add("x-ai", "")
	req.Header.Add("x-ga", "")
	req.Header.Add("x-ma", "")
	req.Header.Add("x-kc", client.Kc)
	req.Header.Add("x-if", "")

	req.Header.Add("x-devicemodel", "iPad12,1")
	req.Header.Add("x-operatingsystem", "iPadOS 17.0")
	req.Header.Add("x-platform", "iOS")
	req.Header.Add("user-agent", "ProductName/211 CFNetwork/1568.100.1.2.1 Darwin/24.0.0")

	req.Header.Add("x-unity-version", "2022.3.21f1")
	req.Header.Add("x-app-hash", client.AppVersion["appHash"])
	req.Header.Add("x-app-version", client.AppVersion["appVersion"])
	req.Header.Add("x-asset-version", client.AppVersion["assetVersion"])
	req.Header.Add("x-data-version", client.AppVersion["dataVersion"])

	req.Header.Add("x-install-id", client.InstallId)
	req.Header.Add("x-request-id", uuid.NewString())

	// add session token and cookie if there is
	if client.SessionToken != "" {
		req.Header.Add("x-session-token", client.SessionToken)
	}

	if client.Cookie != "" {
		req.Header.Add("cookie", client.Cookie)
	}

	// do the request and read status
	resp, err := client.Client.Do(req)
	assert(err)
	defer resp.Body.Close()

	// read the body
	data, err = io.ReadAll(resp.Body)
	assert(err)

	// error handling
	switch resp.StatusCode {
	case http.StatusOK:
		// pass

	case http.StatusForbidden:
		if bytes.Contains(data, []byte("Request blocked.")) {
			go client.Rl.WaitN(context.Background(), 5)
			assert(TooManyRequests(HTTPError{resp.StatusCode}))
		}
		assert(HTTPError{resp.StatusCode})

	case http.StatusUpgradeRequired:
		go client.update()
		assert(HTTPError{resp.StatusCode})

	case http.StatusServiceUnavailable:
		assert(ServerMaintenance(HTTPError{resp.StatusCode}))

	case http.StatusTooManyRequests:
		go client.Rl.WaitN(context.Background(), 5)
		assert(TooManyRequests(HTTPError{resp.StatusCode}))

	default:
		assert(HTTPError{resp.StatusCode})
	}

	// read the new session token and cookie if there is
	if st := resp.Header.Get("x-session-token"); st != "" {
		client.SessionToken = st
	}
	if sck := resp.Header.Get("set-cookie"); sck != "" {
		client.Cookie = sck
	}

	// return json directly
	if resp.Header.Get("Content-Type") == "application/json; charset=utf-8" {
		var body m
		json.Unmarshal(data, &body)
		return body
	}

	// decrypt
	data = client.decrypt(data)
	if len(data) == 0 {
		return nil
	}
	err = msgpack.Unmarshal(data, &body)
	assert(err)

	// update sk clinet data
	if ur, ok := body["updatedResources"]; ok {
		for k, v := range ur.(m) {
			client.Data[k] = v
		}
	}
	return body
}

func (client *SekaiClient) RequestDeobfuscate(method string, url string) []byte {
	req, err := http.NewRequest(method, url, bytes.NewBuffer([]byte{}))
	assert(err)

	if client.Cookie != "" {
		req.Header.Add("cookie", client.Cookie)
	}

	// do the request and read status
	resp, err := client.Client.Do(req)
	assert(err)
	defer resp.Body.Close()

	// read the body
	data, err := io.ReadAll(resp.Body)
	assert(err)

	// error handling
	switch resp.StatusCode {
	case http.StatusOK:
		// pass

	case http.StatusForbidden:
		if bytes.Contains(data, []byte("Request blocked.")) {
			go client.Rl.WaitN(context.Background(), 5)
			assert(TooManyRequests(HTTPError{resp.StatusCode}))
		}
		assert(HTTPError{resp.StatusCode})

	case http.StatusUpgradeRequired:
		go client.update()
		assert(HTTPError{resp.StatusCode})

	case http.StatusServiceUnavailable:
		assert(ServerMaintenance(HTTPError{resp.StatusCode}))

	case http.StatusTooManyRequests:
		go client.Rl.WaitN(context.Background(), 5)
		assert(TooManyRequests(HTTPError{resp.StatusCode}))

	default:
		assert(HTTPError{resp.StatusCode})
	}

	return Deobfuscate(data)
}

func getVersion() map[string]string {
	req, err := http.NewRequest("GET", "https://version.pjsekai.moe/jp.json", nil)
	assert(err)

	resp, err := http.DefaultClient.Do(req)
	assert(err)
	defer resp.Body.Close()

	data, err := io.ReadAll(resp.Body)
	assert(err)

	var version map[string]string
	err = json.Unmarshal(data, &version)
	assert(err)

	return version
}

func (client *SekaiClient) update() {
	log.Println("start to update sekai app version")

	version := getVersion()
	for k, v := range version {
		client.AppVersion[k] = v
	}

	body := client.Request("GET", "https://production-game-api.sekai.colorfulpalette.org/api/system", nil)
	for _, av := range body["appVersions"].(l) {
		av := av.(m)
		if av["appVersionStatus"] == "available" && av["appVersion"] == client.AppVersion["appVersion"] {
			for k, v := range av {
				client.AppVersion[k] = v.(string)
			}

			log.Printf("sekai app version: %v\n", client.AppVersion)
			return
		}
	}

	for _, av := range body["appVersions"].(l) {
		av := av.(m)
		if av["appVersionStatus"] == "available" {
			for k, v := range av {
				client.AppVersion[k] = v.(string)
			}

			log.Printf("sekai app version: %v\n", client.AppVersion)
			return
		}
	}
}
