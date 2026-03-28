#!/usr/bin/env python3
"""简单直接的翻译脚本，按小块翻译"""
import asyncio
import aiohttp
import json
import sys
import time
from pathlib import Path

script_dir = Path(__file__).parent
project_root = script_dir.parent.parent.parent.parent

config = json.load(open(script_dir / 'transpage_config.json'))
API_URL = config['api_base_url'].rstrip('/') + '/chat/completions'
API_KEY = config['api_key']
MODEL = config['model']

LANG_NAMES = {
    'es': 'Spanish (Latin America)',
    'pt': 'Portuguese (Brazil)',
    'ru': 'Russian',
    'ja': 'Japanese',
}

GAME_NAME = 'Bite By Night'
PROTECTED = ['Bite By Night', 'Roblox', 'FNAF', 'Springtrap', 'Ennard', 'Dead by Daylight', 'Discord', 'OzelBlox']


async def translate_chunk(session, chunk_str, lang_name, lang_code, retries=5):
    protected_list = ', '.join(PROTECTED)
    prompt = f"""Translate this JSON to {lang_name}.
Rules:
- Return ONLY valid JSON, no markdown
- Keep all JSON keys in English
- Do NOT translate these terms: {protected_list}
- Preserve all JSON structure exactly

JSON to translate:
{chunk_str}"""

    for attempt in range(retries):
        try:
            payload = {
                'model': MODEL,
                'messages': [{'role': 'user', 'content': prompt}],
                'max_tokens': 8192,
                'stream': False,
                'temperature': 0.1,
            }
            headers = {
                'Authorization': f'Bearer {API_KEY}',
                'Content-Type': 'application/json',
            }
            timeout = aiohttp.ClientTimeout(total=360, connect=15, sock_read=360)
            async with session.post(API_URL, json=payload, headers=headers, timeout=timeout) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    content = data['choices'][0]['message']['content'].strip()
                    # Remove markdown code blocks
                    if content.startswith('```'):
                        lines = content.split('\n')
                        lines = [l for l in lines if not l.startswith('```')]
                        content = '\n'.join(lines).strip()
                    # Validate JSON
                    result = json.loads(content)
                    return result
                else:
                    text = await resp.text()
                    print(f'  [WARN] HTTP {resp.status}: {text[:100]}', flush=True)
        except json.JSONDecodeError as e:
            print(f'  [WARN] JSON parse error attempt {attempt+1}: {e}', flush=True)
        except Exception as e:
            print(f'  [WARN] Error attempt {attempt+1}: {e}', flush=True)

        if attempt < retries - 1:
            await asyncio.sleep(5 * (attempt + 1))

    return None


async def translate_language(lang_code):
    lang_name = LANG_NAMES.get(lang_code, lang_code)
    print(f'\n{"="*60}', flush=True)
    print(f'[START] Translating to {lang_code.upper()} ({lang_name})', flush=True)
    print(f'{"="*60}', flush=True)

    en_file = project_root / 'src' / 'locales' / 'en.json'
    en_data = json.load(open(en_file))

    output_file = project_root / 'src' / 'locales' / f'{lang_code}.json'

    # Load existing partial translation for resume
    result = {}
    if output_file.exists():
        try:
            existing = json.load(open(output_file))
            result = existing
            print(f'[RESUME] Found partial translation with keys: {list(existing.keys())}', flush=True)
        except Exception:
            pass

    connector = aiohttp.TCPConnector(limit=3, limit_per_host=3)
    timeout = aiohttp.ClientTimeout(total=3600)

    async with aiohttp.ClientSession(connector=connector, timeout=timeout) as session:
        for top_key, top_value in en_data.items():
            # Skip already-translated top-level keys (except modules/pages which need sub-key check)
            if top_key in result and top_key not in ('modules', 'pages'):
                print(f'\n[SKIP] {top_key} (already translated)', flush=True)
                continue

            print(f'\n[KEY] {top_key}', flush=True)

            if top_key == 'modules':
                # Translate each module sub-key separately
                if top_key not in result:
                    result[top_key] = {}
                for sub_key, sub_value in top_value.items():
                    if sub_key in result.get(top_key, {}):
                        print(f'  [SKIP] modules.{sub_key} (already translated)', flush=True)
                        continue
                    chunk = {sub_key: sub_value}
                    chunk_str = json.dumps(chunk, indent=2, ensure_ascii=False)
                    print(f'  [SUB] modules.{sub_key} ({len(chunk_str)} chars)', flush=True)
                    start = time.time()
                    translated = await translate_chunk(session, chunk_str, lang_name, lang_code)
                    elapsed = time.time() - start
                    if translated and sub_key in translated:
                        result[top_key][sub_key] = translated[sub_key]
                        print(f'  [OK] modules.{sub_key} ({elapsed:.1f}s)', flush=True)
                    else:
                        print(f'  [FAIL] modules.{sub_key} - keeping English', flush=True)
                        result[top_key][sub_key] = sub_value
                    # Save after each sub-key
                    with open(output_file, 'w', encoding='utf-8') as f:
                        json.dump(result, f, indent=2, ensure_ascii=False)
            elif top_key == 'pages':
                # Translate each page sub-key separately
                if top_key not in result:
                    result[top_key] = {}
                for sub_key, sub_value in top_value.items():
                    if sub_key in result.get(top_key, {}):
                        print(f'  [SKIP] pages.{sub_key} (already translated)', flush=True)
                        continue
                    chunk = {sub_key: sub_value}
                    chunk_str = json.dumps(chunk, indent=2, ensure_ascii=False)
                    print(f'  [SUB] pages.{sub_key} ({len(chunk_str)} chars)', flush=True)
                    start = time.time()
                    translated = await translate_chunk(session, chunk_str, lang_name, lang_code)
                    elapsed = time.time() - start
                    if translated and sub_key in translated:
                        result[top_key][sub_key] = translated[sub_key]
                        print(f'  [OK] pages.{sub_key} ({elapsed:.1f}s)', flush=True)
                    else:
                        print(f'  [FAIL] pages.{sub_key} - keeping English', flush=True)
                        result[top_key][sub_key] = sub_value
                    # Save after each sub-key
                    with open(output_file, 'w', encoding='utf-8') as f:
                        json.dump(result, f, indent=2, ensure_ascii=False)
            else:
                # Translate entire top-level key
                chunk = {top_key: top_value}
                chunk_str = json.dumps(chunk, indent=2, ensure_ascii=False)
                print(f'  Size: {len(chunk_str)} chars', flush=True)
                start = time.time()
                translated = await translate_chunk(session, chunk_str, lang_name, lang_code)
                elapsed = time.time() - start
                if translated and top_key in translated:
                    result[top_key] = translated[top_key]
                    print(f'  [OK] {top_key} ({elapsed:.1f}s)', flush=True)
                else:
                    print(f'  [FAIL] {top_key} - keeping English', flush=True)
                    result[top_key] = top_value

            # Save progress after each top-level key
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(result, f, indent=2, ensure_ascii=False)

    print(f'\n[DONE] {lang_code.upper()} saved to {output_file}', flush=True)

    # Check for Lucid Blocks residuals
    output_str = json.dumps(result)
    lucid_count = output_str.count('Lucid Blocks')
    print(f'[CHECK] "Lucid Blocks" occurrences: {lucid_count}', flush=True)

    return lucid_count == 0


async def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--lang', type=str, help='Languages to translate (comma-separated)')
    args = parser.parse_args()

    if args.lang:
        langs = [l.strip() for l in args.lang.split(',')]
    else:
        # Read from routing.ts
        routing_file = project_root / 'src' / 'i18n' / 'routing.ts'
        content = routing_file.read_text()
        import re
        match = re.search(r"locales:\s*\[([^\]]+)\]", content)
        if match:
            locales_str = match.group(1)
            langs = [l.strip().strip("'\"") for l in locales_str.split(',') if l.strip().strip("'\"") != 'en']
        else:
            langs = list(LANG_NAMES.keys())

    print(f'Languages to translate: {", ".join(langs)}', flush=True)

    for lang in langs:
        success = await translate_language(lang)
        if success:
            print(f'✓ {lang} completed without Lucid Blocks residuals', flush=True)
        else:
            print(f'⚠ {lang} has Lucid Blocks residuals', flush=True)

    print('\n[ALL DONE]', flush=True)


if __name__ == '__main__':
    asyncio.run(main())
