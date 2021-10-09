package main

import (
	"log"

	"github.com/pgm/muddy"
)

func main() {
	log.Printf("Starting...")
	muddy.Start("127.0.0.1:7200")
}
