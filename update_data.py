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
ROOT = pathlib.Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / 'data' / 'boca.json'
SEED_PATH = ROOT / 'assets' / 'seed.js'
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
    complete = kind.get('completed') or status.get('completed')
    if state == 'post' or complete:
        state = 'final'
    elif state in ('in', 'live'):
        state = 'in'
    else:
        state = 'pre'
    # ESPN sometimes returns numeric score 0 before kickoff; never show it as a final result.
    if state == 'pre':
        home_team['score'] = None
        away_team['score'] = None
    venue = competition.get('venue') or {}
    venue_name = venue.get('fullName') if isinstance(venue, dict) else None
    if not venue_name and isinstance(venue, dict):
        venue_name = venue.get('shortName')
    url = ''
    links = event.get('links') or []
    for obj in links:
        if isinstance(obj, dict) and obj.get('href', '').startswith('https://'):
            url = obj['href']
            break
    return {
        'id': str(event.get('id') or f'{league}-{date}-{home_team["name"]}'),
        'date': date,
        'competition': (event.get('season') or {}).get('displayName') or LEAGUES.get(league,league),
        'leagueSlug': league,
        'status': state,
        'home': home_team,
        'away': away_team,
        'venue': venue_name,
        'sourceUrl': url or None,
    }

def get_matches():
    now = dt.datetime.now(UTC)
    # The team schedule includes all rounds and avoids the scoreboard's default event limit.
    # Some cup competitions may not expose team schedules, so try a date-scoped scoreboard.
    out, reached = [], set()
    for slug in LEAGUES:
        url = f'{BASE}/{slug}/teams/{TEAM_ID}/schedule?season={now.year}&limit=250'
        feed = get_json(url)
        events = (feed or {}).get('events')
        if not isinstance(events, list):
            events = []
        parsed = [p for event in events if (p := parse_match(event, slug))]
        if parsed:
            reached.add(slug)
            out.extend(parsed)
            print(f'{slug}: {len(parsed)} eventos de agenda')
            continue
        # A small window is cheaper than querying all the league's games for a full season.
        start = (now-dt.timedelta(days=32)).strftime('%Y%m%d')
        end = (now+dt.timedelta(days=65)).strftime('%Y%m%d')
        board = get_json(f'{BASE}/{slug}/scoreboard?dates={start}-{end}&limit=500')
        events = (board or {}).get('events')
        if isinstance(events,list):
            reached.add(slug)
            out.extend(p for event in events if (p := parse_match(event, slug)))
    # ESPN may list the same game in multiple feeds; use event ID first, plus day/opponent.
    unique = {}
    for match in out:
        key = (match['date'][:10], norm(match['home']['name']), norm(match['away']['name']))
        old = unique.get(key)
        if not old or (match['status'] == 'final' and old['status'] != 'final'):
            unique[key] = match
    return sorted(unique.values(), key=lambda m:m['date']), reached

def parse_roster(blob):
    athletes = blob.get('athletes') or []
    if isinstance(athletes,dict):
        athletes = list(athletes.values())
    rows = []
    for group in athletes:
        if not isinstance(group,dict):
            continue
        items = group.get('items') if isinstance(group.get('items'),list) else [group]
        group_label = group.get('name') or group.get('position') or ''
        if isinstance(group_label,dict):
            group_label=group_label.get('displayName','')
        for item in items:
            if not isinstance(item,dict):
                continue
            athlete = item.get('athlete') if isinstance(item.get('athlete'),dict) else item
            name = athlete.get('displayName') or athlete.get('fullName')
            if not name:
                continue
            position = athlete.get('position') or item.get('position') or group_label
            if isinstance(position,dict):
                position = position.get('displayName') or position.get('name') or position.get('abbreviation')
            position = position or 'Jugador'
            rows.append({'id':str(athlete.get('id') or name),'name':name,'position':position,'number':str(athlete.get('jersey') or athlete.get('jerseyNumber') or '')})
    return list({player['id']:player for player in rows}.values())

def get_roster():
    for url in [f'{BASE}/arg.1/teams/{TEAM_ID}/roster',f'{BASE}/arg.1/teams/{TEAM_ID}?enable=roster']:
        blob = get_json(url)
        if not blob:
            continue
        players = parse_roster(blob)
        if players:
            print(f'Plantel: {len(players)} jugadores')
            return sorted(players,key=lambda p:(norm(p['position']),norm(p['name'])))
    return None

def stat(stats, *names):
    names={norm(x) for x in names}
    for x in stats:
        if not isinstance(x,dict):
            continue
        if norm(x.get('name')) in names or norm(x.get('abbreviation')) in names or norm(x.get('label')) in names:
            return x.get('value',x.get('displayValue'))
    return None

def get_standings():
    # /apis/v2 (without /site) gives full standings on most ESPN feeds.
    url='https://site.api.espn.com/apis/v2/sports/soccer/arg.1/standings'
    blob=get_json(url)
    if not blob:
        return None,None
    result=[]
    def scan(node,label):
        if not isinstance(node,dict):return
        info=node.get('standings') or {}
        entries=info.get('entries') if isinstance(info,dict) else None
        if isinstance(entries,list) and entries:
            rows=[]
            for idx,item in enumerate(entries,1):
                team=item.get('team') or {}
                stats=item.get('stats') or []
                logos=team.get('logos') or []
                logo=logos[0].get('href') if logos and isinstance(logos[0],dict) else ''
                name=team.get('displayName') or team.get('name')
                if not name:continue
                rank=stat(stats,'rank','playoffSeed','seed') or idx
                rows.append({'name':name,'rank':rank,'played':stat(stats,'gamesPlayed','played','GP','P'), 'points':stat(stats,'points','PTS','point'), 'diff':stat(stats,'pointDifferential','goalDifference','GD','DG'), 'logo':logo, 'group':label})
            if rows:result.append({'name':label or 'Tabla general','teams':rows})
        for child in node.get('children') or []:
            scan(child,child.get('name') or child.get('abbreviation') or label)
    scan(blob,blob.get('name') or 'Clasificación general')
    # Reject unsuitable data if there is no Boca row. This is safer than showing another tournament.
    if not any(is_boca(row['name']) for g in result for row in g['teams']):
        print('La tabla obtenida no contiene a Boca; se conserva la anterior.',file=sys.stderr)
        return None,None
    print(f'Posiciones: {len(result)} grupos')
    return result, blob.get('name') or 'Liga Profesional de Fútbol'

def get_news():
    params={'q':'"Boca Juniors" when:7d','hl':'es-419','gl':'AR','ceid':'AR:es-419'}
    url='https://news.google.com/rss/search?'+urllib.parse.urlencode(params)
    try:
        root=ET.fromstring(get_url(url))
        items=[]
        for item in root.findall('.//channel/item'):
            title=(item.findtext('title') or '').strip()
            link=(item.findtext('link') or '').strip()
            source=item.find('source')
            source_name=source.text if source is not None else 'Google Noticias'
            if not title or not link.startswith('https://') or not is_boca(title) and 'boca' not in norm(title):
                continue
            published=item.findtext('pubDate')
            try:
                when=email.utils.parsedate_to_datetime(published).astimezone(UTC).isoformat() if published else None
            except (ValueError,TypeError,OverflowError):
                when=None
            items.append({'title':title,'url':link,'source':source_name,'published':when})
        unique=list({item['title']:item for item in items}.values())[:18]
        print(f'Noticias: {len(unique)}')
        return unique or None
    except (ET.ParseError, OSError, urllib.error.URLError, TimeoutError) as exc:
        print(f'[Aviso] Google News RSS: {exc}',file=sys.stderr)
        return None

def merge_matches(previous,new,reached):
    if not reached:
        return previous
    # Replace feed coverage only for valid fresh leagues; preserve competitions that failed.
    preserved=[m for m in previous if m.get('leagueSlug') not in reached and not (m.get('id') or '').startswith('initial-')]
    # Initial seed entries are only reference until the first successful fetch.
    if not new and not preserved:
        return previous
    joined=preserved+new
    unique={}
    for m in joined:
        day=m.get('date','')[:10]
        key=(day,norm(m.get('home',{}).get('name')),norm(m.get('away',{}).get('name')))
        unique[key]=m
    now=dt.datetime.now(UTC)
    valid=[]
    for m in unique.values():
        try:d=dt.datetime.fromisoformat(m['date'].replace('Z','+00:00'))
        except (ValueError,TypeError):continue
        if d.tzinfo is None:d=d.replace(tzinfo=UTC)
        if now-dt.timedelta(days=110) <= d <= now+dt.timedelta(days=280):valid.append(m)
    return sorted(valid,key=lambda x:x['date'])[-120:]

def run():
    data=json.loads(DATA_PATH.read_text(encoding='utf-8'))
    meta=data.setdefault('meta',{})
    successes=0
    matches,reached=get_matches()
    if matches:
        data['matches']=merge_matches(data.get('matches',[]),matches,reached)
        meta['matchesAt']=utc_now();successes+=1
    else:print('Partidos sin novedades útiles; se preservan los datos existentes.',file=sys.stderr)
    # Only a partial failure is acceptable: each section has its own freshness time.
    players=get_roster()
    if players:
        data['roster']=players;meta['rosterAt']=utc_now();successes+=1
    table,title=get_standings()
    if table:
        data['standings']=table;meta['standingsCompetition']=title;meta['standingsAt']=utc_now();successes+=1
    news=get_news()
    if news:
        data['news']=news;meta['newsAt']=utc_now();successes+=1
    if successes:
        meta['updatedAt']=utc_now()
    # Preserve the snapshot when every source is down; don't stamp fictitious freshness.
    encoded=json.dumps(data,ensure_ascii=False,indent=2)+'\n'
    DATA_PATH.write_text(encoded,encoding='utf-8')
    SEED_PATH.write_text('window.BOCA_SEED_DATA = '+json.dumps(data,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf-8')
    print(f'Sincronizaciones exitosas: {successes}/4; registros {len(data.get("matches",[]))} partidos, {len(data.get("roster",[]))} jugadores')
    return 0

if __name__=='__main__':
    raise SystemExit(run())
