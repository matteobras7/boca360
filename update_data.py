#!/usr/bin/env python3
"""Refresh Boca 360° public feeds (stdlib only, no paid API key).

ESPN endpoints are undocumented/unofficial and can change. Failures preserve the
last successful section. No errors should turn a missing datum into fake data.
"""
from __future__ import annotations
import datetime as dt
import email.utils
import json
import os
import pathlib
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer'
ROOT = pathlib.Path(__file__).resolve().parent
DATA_PATH = ROOT / 'boca.json'
SEED_PATH = ROOT / 'seed.js'
TEAM_ID = '5'  # Confirmed for Boca Juniors on ESPN's arg.1 teams feed
LEAGUES = {
    'arg.1': 'Liga Profesional',
    'arg.copa': 'Copa Argentina',
    'conmebol.sudamericana': 'Copa Sudamericana',
    'conmebol.libertadores': 'Copa Libertadores',
}
HEADERS = {'User-Agent': 'Boca360FanApp/1.0 (+https://github.com/; personal noncommercial project)', 'Accept': 'application/json, application/xml, text/xml, */*'}
TIMEOUT = 13
UTC = dt.timezone.utc

def norm(value):
    value = unicodedata.normalize('NFKD', str(value or '').lower())
    return ''.join(c for c in value if not unicodedata.combining(c)).strip()

def is_boca(name):
    name = norm(name)
    return 'boca juniors' in name or name in ('boca', 'cabj')

def utc_now():
    return dt.datetime.now(UTC).replace(microsecond=0).isoformat().replace('+00:00', 'Z')

def get_url(url):
    request = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(request, timeout=TIMEOUT) as response:
        if response.status != 200:
            raise RuntimeError(f'HTTP {response.status}')
        return response.read(4_000_000)

def get_json(url):
    try:
        obj = json.loads(get_url(url).decode('utf-8'))
        if not isinstance(obj, dict):
            raise ValueError('JSON no es un objeto')
        return obj
    except (OSError, ValueError, urllib.error.URLError, TimeoutError) as exc:
        print(f'[Aviso] {url}: {exc}', file=sys.stderr)
        return None

def team_info(entry):
    team = entry.get('team') or {}
    logos = team.get('logos') or []
    logo = logos[0].get('href') if logos and isinstance(logos[0], dict) else ''
    score = entry.get('score')
    if isinstance(score, dict):
        score = score.get('value') or score.get('displayValue')
    try:
        score = int(score) if score is not None and str(score) != '' else None
    except (ValueError, TypeError):
        score = None
    return {'name': team.get('displayName') or team.get('shortDisplayName') or team.get('name') or 'Equipo', 'score': score, 'logo': logo}

def parse_match(event, league):
    if not isinstance(event, dict):
        return None
    competitions = event.get('competitions') or []
    competition = competitions[0] if competitions and isinstance(competitions[0], dict) else {}
    entries = competition.get('competitors') or []
    if len(entries) < 2:
        return None
    home = next((e for e in entries if e.get('homeAway') == 'home'), entries[0])
    away = next((e for e in entries if e.get('homeAway') == 'away'), entries[-1])
    home_team, away_team = team_info(home), team_info(away)
    if not (is_boca(home_team['name']) or is_boca(away_team['name']) or str((home.get('team') or {}).get('id')) == TEAM_ID or str((away.get('team') or {}).get('id')) == TEAM_ID):
        return None
    date = event.get('date') or competition.get('date')
    if not date or not re.match(r'^\d{4}-\d\d-\d\dT', date):
        return None
    status = (event.get('status') or competition.get('status') or {})
    kind = (status.get('type') or {}) if isinstance(status, dict) else {}
    state = kind.get('state') or status.get('state') or 'pre'
