"""Connect only the dedicated YouTube Turbo Hosting site and DNS hostname."""

import json
import os
import subprocess
import time
from urllib.error import HTTPError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


PROJECT = 'millionsnest'
SITE = 'mn-turbo-555464791734'
HOST = 'youtubeturbo.millionsnest.com'
ZONE = 'millionsnest.com'
FIREBASE = 'https://firebasehosting.googleapis.com/v1beta1'
CLOUDFLARE = 'https://api.cloudflare.com/client/v4'
HOSTING_TYPES = {'A', 'AAAA', 'CNAME'}


def gcloud(*arguments):
    return subprocess.check_output(['gcloud', *arguments], text=True).strip()


def request(url, token, method='GET', payload=None, acceptable=()):
    data = json.dumps(payload).encode() if payload is not None else None
    command = Request(url, data=data, method=method)
    command.add_header('Authorization', 'Bearer ' + token)
    command.add_header('Content-Type', 'application/json')
    try:
        with urlopen(command, timeout=25) as response:
            return json.load(response)
    except HTTPError as error:
        if error.code in acceptable:
            return None
        service = 'Firebase' if url.startswith(FIREBASE) else 'Cloudflare'
        failure = json.loads(error.read().decode('utf-8', 'replace') or '{}')
        detail = failure.get('error', {}).get('status', '')
        raise SystemExit(f'{service} returned HTTP {error.code} for {method} {detail}') from None


def firebase_domain(token):
    base = f'{FIREBASE}/projects/{PROJECT}/sites/{SITE}/customDomains'
    url = f'{base}/{HOST}'
    domain = request(url, token, acceptable=(404,))
    if domain is None:
        request(
            f'{base}?{urlencode({"customDomainId": HOST})}',
            token,
            method='POST',
            payload={'certPreference': 'DEDICATED', 'annotations': {'managed-by': 'millionsnest-ci'}},
            acceptable=(409,),
        )
        for attempt in range(12):
            domain = request(url, token, acceptable=(404,))
            if domain is not None and (domain.get('requiredDnsUpdates') or not domain.get('reconciling')):
                break
            time.sleep(5)
    if domain is None:
        raise SystemExit('Firebase did not return the new custom domain.')
    return domain


def firebase_records(domain):
    pending = (domain.get('requiredDnsUpdates') or {}).get('desired', [])
    cert = domain.get('cert') or {}
    cert_dns = ((cert.get('verification') or {}).get('dns') or {}).get('desired', [])
    normalized = set()

    for record in [*pending, *cert_dns]:
        name = record['domainName'].rstrip('.').lower()
        kind = record['type']
        value = record['rdata'].strip().strip('"')
        if kind == 'CNAME':
            value = value.rstrip('.')
        if name != HOST and not name.endswith('.' + HOST):
            raise SystemExit(f'Firebase requested a record outside the dedicated hostname: {name}')
        if kind not in HOSTING_TYPES | {'TXT', 'CAA'} or not value:
            raise SystemExit(f'Unsupported Firebase DNS record type: {kind}')
        normalized.add((name, kind, value))

    if not normalized and domain.get('hostState') == 'HOST_UNHOSTED':
        normalized.add((HOST, 'CNAME', f'{SITE}.web.app'))
    return sorted(normalized)


def cloudflare_records(records, token):
    def api(path, method='GET', payload=None):
        result = request(CLOUDFLARE + path, token, method=method, payload=payload)
        if not result['success']:
            raise SystemExit(f'Cloudflare did not accept the {method} DNS operation.')
        return result['result']

    zones = api('/zones?' + urlencode({'name': ZONE, 'status': 'active'}))
    if len(zones) != 1 or zones[0]['name'] != ZONE:
        raise SystemExit('Could not confirm the active MillionsNest zone.')
    path = f'/zones/{zones[0]["id"]}/dns_records'
    existing_by_name = {
        name: api(path + '?' + urlencode({'name': name}))
        for name in {record[0] for record in records}
    }
    changes = []

    for name, kind, value in records:
        existing = existing_by_name[name]
        match = next((entry for entry in existing if
                      entry['type'] == kind and entry['content'].strip('"').rstrip('.') == value.rstrip('.')), None)
        payload = {'type': kind, 'name': name, 'content': value, 'ttl': 1}
        if kind in HOSTING_TYPES:
            payload['proxied'] = False
        if match:
            if kind in HOSTING_TYPES and match.get('proxied'):
                changes.append((f'{path}/{match["id"]}', 'PUT', payload))
            else:
                print(f'DNS already configured: {kind} {name}')
            continue
        if kind in HOSTING_TYPES:
            routes = [entry for entry in existing if entry['type'] in HOSTING_TYPES]
            previous_preview = next((entry for entry in routes if
                                     entry['type'] == kind == 'CNAME'
                                     and entry['content'].rstrip('.') == 'custom-domains.chatgpt.site'), None)
            if previous_preview:
                changes.append((f'{path}/{previous_preview["id"]}', 'PUT', payload))
                continue
            if any(entry['type'] in {kind, 'CNAME'} or kind == 'CNAME' for entry in routes):
                raise SystemExit(f'Unexpected existing DNS route at {name}. No DNS changes applied.')
        changes.append((path, 'POST', payload))

    for endpoint, method, payload in changes:
        api(endpoint, method=method, payload=payload)
        print(f'Configured {payload["type"]} {payload["name"]}')


def main():
    if (os.environ['FIREBASE_PROJECT'], os.environ['HOSTING_SITE'], os.environ['CUSTOM_DOMAIN']) != (PROJECT, SITE, HOST):
        raise SystemExit('Unexpected project, Firebase Hosting site or DNS hostname.')
    domain = firebase_domain(gcloud('auth', 'print-access-token'))
    records = firebase_records(domain)
    if records:
        cloudflare_records(records, gcloud('secrets', 'versions', 'access', 'latest',
                                            '--secret=mn-cloudflare-dns-token', f'--project={PROJECT}'))
    print(f'Firebase domain: {HOST}')
    print(f'Hosting state: {domain.get("hostState")}; certificate state: {(domain.get("cert") or {}).get("state")}')


if __name__ == '__main__':
    main()
