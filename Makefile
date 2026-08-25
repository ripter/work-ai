# WorkAI PICO-8 dice roller — build the web export
#
#   make              # build a single self-contained web/game.html (open in a browser)
#   make multiplayer  # build web/game.html + web/game.js (served by pico-socket)
#   make clean        # remove generated web files

PICO8 := /Applications/pico-8/PICO-8.app/Contents/MacOS/pico8
WEB   := web
HTML  := $(WEB)/game.html
JS    := $(WEB)/game.js

.PHONY: all static multiplayer clean

# default: a static, self-contained game.html you can load straight in a browser
all: static

# single self-contained file: build the export, then inline game.js into game.html
static: multiplayer
	node $(WEB)/inline.js $(HTML) $(JS) $(HTML)
	@echo "open $(HTML) in a browser to play (solo)"

# standard export (game.html references game.js) — what pico-socket serves
multiplayer:
	sh $(WEB)/build.sh

clean:
	rm -f $(HTML) $(JS)
