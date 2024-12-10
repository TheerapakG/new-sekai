package main

import (
	"bytes"
	"crypto/aes"
	"crypto/cipher"
)

type Crypt struct {
	key []byte
	iv  []byte
	jwt []byte
}

const blockSize = 16

func (c *Crypt) newCipher() cipher.Block {
	block, err := aes.NewCipher(c.key)
	if err != nil {
		panic(err)
	}
	return block
}

func (c *Crypt) encrypt(plaintext []byte) []byte {
	paddingSize := blockSize - len(plaintext)%blockSize
	padding := bytes.Repeat([]byte{byte(paddingSize)}, paddingSize)
	plaintext = append(plaintext, padding...)

	ciphertext := make([]byte, len(plaintext))
	encrypter := cipher.NewCBCEncrypter(c.newCipher(), c.iv)
	encrypter.CryptBlocks(ciphertext, plaintext)
	return ciphertext
}

func (c *Crypt) decrypt(ciphertext []byte) []byte {
	plaintext := make([]byte, len(ciphertext))
	decrypter := cipher.NewCBCDecrypter(c.newCipher(), c.iv)
	decrypter.CryptBlocks(plaintext, ciphertext)

	paddingSize := int(plaintext[len(plaintext)-1])
	plaintext = plaintext[:len(plaintext)-paddingSize]
	return plaintext
}
