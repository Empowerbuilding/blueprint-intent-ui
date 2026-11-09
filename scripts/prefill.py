#!/usr/bin/env python3
"""prefill.py — push transcript-derived intent into the Design Intent UI.

Used by design-brain (or a human) to pre-fill room cards from meeting
transcripts. The UI is for correcting + confirming, not typing from scratch.

Usage:
  PREFILL_SECRET=... python3 prefill.py --app http://localhost:3000 --payload payload.json

Payload contract (see /api/prefill):
  {
    "project": {"name": "Whitaker", "client": "The Whitakers"},
    "rooms": [
      {"section_code": "B3", "name": "Kitchen",
       "decisions": [{"topic": "hood", "value": "charcoal 54in accent", "source": "transcript",
                       "source_ref": "11/06 14:22", "meeting_date": "2026-11-06"}],
       "open_questions": [{"question": "floating vanities?", "default_if_unanswered": "standard 21in full-run"}],
       "redline_notes": [{"note_type": "beam", "text": "heavy line at grid C = beam not wall"}]}
    ]
  }
"""
import argparse
import json
import os
import sys
import urllib.request


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--app', required=True, help='app base url, e.g. http://localhost:3000')
    ap.add_argument('--payload', required=True, help='path to payload json')
    args = ap.parse_args()

    secret = os.environ.get('PREFILL_SECRET')
    if not secret:
        sys.exit('PREFILL_SECRET env var required')

    body = json.dumps(json.load(open(args.payload))).encode()
    req = urllib.request.Request(
        f'{args.app.rstrip("/")}/api/prefill',
        data=body,
        headers={'x-prefill-secret': secret, 'Content-Type': 'application/json'},
        method='POST',
    )
    try:
        r = urllib.request.urlopen(req, timeout=60)
        print(r.read().decode())
    except urllib.error.HTTPError as e:
        sys.exit(f'HTTP {e.code}: {e.read().decode()[:500]}')


if __name__ == '__main__':
    main()
