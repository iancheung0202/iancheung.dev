# zola build  -> public/      (static pages, css, js, images)
# python3 main.py             (flask: serves public/ + api)

.PHONY: build run dev clean

build:
	zola build

run: build
	python3 main.py

dev:
	zola build
	(while inotifywait -qq -r -e modify,create,delete,move content templates static config.toml; do zola build; done) &
	python3 main.py

clean:
	rm -rf public
