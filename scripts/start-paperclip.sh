#!/usr/bin/env bash
cd /home/ichigo/alexandria/paperclip
exec node --import ./server/node_modules/tsx/dist/loader.mjs ./server/src/index.ts
