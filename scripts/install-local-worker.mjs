// Local macOS development supervisor. Production requires an always-on server.
import { mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
const root=resolve(import.meta.dirname,'..');
const escape=v=>v.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const directory=resolve(homedir(),'Library/LaunchAgents');mkdirSync(directory,{recursive:true});mkdirSync(resolve(root,'data'),{recursive:true});
const path=resolve(directory,'com.nugaom.autopick.plist');
writeFileSync(path,`<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>Label</key><string>com.nugaom.autopick</string><key>ProgramArguments</key><array><string>/usr/bin/caffeinate</string><string>-i</string><string>${escape(process.execPath)}</string><string>--env-file=.env.local</string><string>scripts/auto-pick-worker.mjs</string></array><key>WorkingDirectory</key><string>${escape(root)}</string><key>RunAtLoad</key><true/><key>KeepAlive</key><true/><key>ThrottleInterval</key><integer>30</integer><key>StandardOutPath</key><string>${escape(root)}/data/worker.stdout.log</string><key>StandardErrorPath</key><string>${escape(root)}/data/worker.stderr.log</string></dict></plist>`);
console.log(path);
