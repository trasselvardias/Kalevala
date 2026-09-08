# Kalevala for Android

An offline-first reader and field guide for the 1849 *Kalevala*. The app ships with the complete Finnish text and John Martin Crawford's English translation, so reading, search, bookmarks, notes, daily verses, and the reference guide work without an account or internet connection.

## What is included

- All 50 runes in Finnish (22,796 non-empty verse lines)
- All 50 runes in English (22,255 non-empty verse lines)
- Fast full-text search in one or both language packs
- Exact per-language reading progress
- Rune favourites, line bookmarks, and private notes
- Read-aloud through the Android text-to-speech service
- Bilingually aligned daily verse and a story-arc guide
- Every rune divided into named, line-ranged narrative parts with quick navigation
- 208 bilingual Tietäjä articles, including 147 old Finnish word entries with fuller contextual explanations
- Recognized Tietäjä terms highlighted in the poem; the line sheet shows only words that actually have an article
- Parchment, night, and system themes; adjustable type size and line spacing
- Phone, tablet, portrait, landscape, and right-to-left layout support
- Installable browser edition with the same rune texts, summaries, Tietäjä catalog, and visual identity

The visual identity uses the **Runonlaulajan kädet** motif. The Hannunvaakuna appears as a decorative divider. The straight-armed swastika is deliberately excluded from launcher and navigation imagery; it appears only inside an explicitly historical, contextualized reference entry.

## Install the supplied APK

1. Copy `Kalevala-1.2.1-debug.apk` to an Android device running Android 8.0 (API 26) or newer.
2. Open the file and allow installation from that file-manager or browser when Android asks.
3. If an earlier debug build with a different signing key is installed, uninstall it first.

This is a development build signed with an Android debug key. It is suitable for testing and personal installation, but a Play Store release must be rebuilt and signed with the publisher's private release key.

## Build from source

Requirements:

- Android Studio Ladybug or newer, or Android SDK Platform 35 with Build Tools 35
- JDK 17
- Python 3 only if you want to verify or regenerate the language packs

Open the repository root in Android Studio and run the `app` configuration, or use the Gradle wrapper:

```bash
./gradlew testDebugUnitTest lintDebug assembleDebug
```

The APK is written to `app/build/outputs/apk/debug/app-debug.apk`.

## Publish the browser edition on GitHub Pages

The website reads the same checked-in source data as the Android app. Its build copies both canonical rune packs directly from `app/src/main/assets`, and an automated test requires the browser catalog to match the Android section summaries, Tietäjä entries, story arcs, and daily-verse anchors exactly.

1. Push the repository to GitHub.
2. In **Settings → Pages**, select **GitHub Actions** as the source.
3. Run **Publish browser edition**, or push to `main` or `master`.

The workflow builds the APK, places it behind the website's **Download app** button, and publishes the static site. To build the same folder locally:

```bash
python3 scripts/build_web.py --output build/web --apk app/build/outputs/apk/debug/app-debug.apk
```

Verify the checked-in corpus independently:

```bash
python3 scripts/verify_corpus.py
```

To regenerate both packs from Project Gutenberg (network access required):

```bash
python3 scripts/prepare_corpus.py
```

The generator records a SHA-256 digest of each downloaded source inside its output pack. See [docs/LANGUAGE_PACKS.md](docs/LANGUAGE_PACKS.md) for the schema and validation rules.

## Privacy and offline behavior

The manifest requests no internet permission. Reading data and settings stay on the device using app assets and Android preferences. The read-aloud button delegates speech to the device's installed text-to-speech engine; the engine itself may have separate download or cloud behavior controlled by Android and that engine's settings. There are no accounts, ads, analytics, or tracking SDKs.

## Content sources

- Finnish text: [Project Gutenberg eBook 7000](https://www.gutenberg.org/ebooks/7000), based on the Finnish Literature Society's 28th printing of the 1849 *Kalevala*
- English text: [Project Gutenberg eBook 5186](https://www.gutenberg.org/ebooks/5186), translated by John Martin Crawford
- Cultural framing: [SKS Tietävä — Who wrote the Kalevala?](https://tietava.finlit.fi/en/kalevala/who-wrote-the-kalevala/)
- Narrative part ranges: [W. F. Kirby's 1907 Kalevala edition on Wikisource](https://en.wikisource.org/wiki/Kalevala_(Kirby_1907))
- Language references: [Avoin Kalevala](https://editiot.finlit.fi/exist/apps/kalevala/), [Kotus Kalevala language collection](https://kotus.fi/ajankohtaista/teemakoosteet/kalevala-sanan-virkkoi-noin-nimesi/), and Aimo Turunen's *Kalevalan sanakirja* (SKS, 1949)
- Runonlaulajan kädet vector source: [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Runonlaulajan_k%C3%A4det.svg)

The two Project Gutenberg source texts and the Commons motif are identified as public domain in the United States by their respective source pages. Distribution rules can vary by country; verify local status before redistributing a release.

## License

Created by **Trassel Vardias**.

Original application code and documentation are licensed under the [Apache License 2.0](LICENSE). The bundled literary texts and public-domain motif retain the source and status described in [NOTICE](NOTICE); they are not relicensed as application code.
