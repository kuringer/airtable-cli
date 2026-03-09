VERSION ?= $(shell git describe --tags --always --dirty 2>/dev/null || echo "dev")
LDFLAGS := -ldflags "-X main.version=$(VERSION)"
ARCH_HOST := swift3-arch

.PHONY: build build-linux test clean install install-mac install-arch

build:
	go build $(LDFLAGS) -o airtable .

build-linux:
	GOOS=linux GOARCH=amd64 go build $(LDFLAGS) -o airtable-linux .

test:
	go test ./... -v

clean:
	rm -f airtable airtable-linux

install-mac: build
	cp airtable ~/.local/bin/

install-arch: build-linux
	scp airtable-linux $(ARCH_HOST):~/.local/bin/airtable

install: install-mac install-arch
	@echo "Installed on macOS and Arch"

.DEFAULT_GOAL := build
