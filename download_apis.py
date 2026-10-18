"""
download_apis.py — 10 Popular API specs ek command mein download karo
Run: python download_apis.py
"""

import os
import urllib.request

SAVE_FOLDER = "api_docs"
os.makedirs(SAVE_FOLDER, exist_ok=True)

APIS = [
    {
        "name": "GitHub API",
        "file": "github-api.yaml",
        "url": "https://raw.githubusercontent.com/github/rest-api-description/main/descriptions/api.github.com/api.github.com.yaml"
    },
    {
        "name": "Stripe API",
        "file": "stripe-api.yaml",
        "url": "https://raw.githubusercontent.com/stripe/openapi/master/openapi/spec3.yaml"
    },
    {
        "name": "PetStore API (Swagger Sample)",
        "file": "petstore-api.yaml",
        "url": "https://petstore3.swagger.io/api/v3/openapi.yaml"
    },
    {
        "name": "OpenAI API",
        "file": "openai-api.yaml",
        "url": "https://raw.githubusercontent.com/openai/openai-openapi/master/openapi.yaml"
    },
    {
        "name": "NASA API",
        "file": "nasa-api.yaml",
        "url": "https://raw.githubusercontent.com/APIs-guru/openapi-directory/main/APIs/nasa.gov/apod/1.0.0/openapi.yaml"
    },
    {
        "name": "Notion API",
        "file": "notion-api.yaml",
        "url": "https://raw.githubusercontent.com/APIs-guru/openapi-directory/main/APIs/notion.com/1.0.0/openapi.yaml"
    },
    {
        "name": "Twitter API",
        "file": "twitter-api.json",
        "url": "https://raw.githubusercontent.com/twitterdev/twitter-openapi/main/dist/twitter-openapi.json"
    },
    {
        "name": "Discord API",
        "file": "discord-api.json",
        "url": "https://raw.githubusercontent.com/discord/discord-api-spec/main/specs/openapi.json"
    },
    {
        "name": "Spotify API",
        "file": "spotify-api.yaml",
        "url": "https://raw.githubusercontent.com/sonallux/spotify-web-api/main/official-spotify-open-api.yaml"
    },
    {
        "name": "Kubernetes API",
        "file": "kubernetes-api.json",
        "url": "https://raw.githubusercontent.com/kubernetes/kubernetes/master/api/openapi-spec/swagger.json"
    },
]

print("=" * 50)
print("  API Specs Downloader")
print("=" * 50)

success = 0
failed  = []

for api in APIS:
    path = os.path.join(SAVE_FOLDER, api["file"])
    # Already downloaded toh skip karo
    if os.path.exists(path) and os.path.getsize(path) > 1000:
        print(f"\n⏭️  Skipping: {api['name']} (already downloaded)")
        success += 1
        continue

    print(f"\n⬇️  Downloading: {api['name']} ...", end=" ", flush=True)
    try:
        urllib.request.urlretrieve(api["url"], path)
        size = os.path.getsize(path)
        print(f"✅ Done ({size // 1024} KB)")
        success += 1
    except Exception as e:
        print(f"❌ Failed — {e}")
        failed.append(api["name"])

print("\n" + "=" * 50)
print(f"  ✅ {success}/{len(APIS)} APIs downloaded → ./{SAVE_FOLDER}/ folder mein hain")
if failed:
    print(f"  ❌ Failed: {', '.join(failed)}")
print("=" * 50)
print("\nAb app mein Upload tab se yeh files upload karo!")
