# Arena SFX sources

Retrieved and checked on 2026-11-12. All four files use separate recorded takes from **Voice Clip Pack - Male Adventurer RPG**, uploaded by **wolfwoot**, credited as **Brandon Song**. The original asset page explicitly lists CC0 and links to the CC0 1.0 deed. No paid generation was used.

| Delivered file | Original URL | Original archive entry | License |
| --- | --- | --- | --- |
| `egg-scream_01.mp3` | [Voice Clip Pack - Male Adventurer RPG](https://opengameart.org/content/voice-clip-pack-male-adventurer-rpg) | `RPG Male Adventurer/attackbig0.wav` | [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/) |
| `pro-shout_01.mp3` | [Voice Clip Pack - Male Adventurer RPG](https://opengameart.org/content/voice-clip-pack-male-adventurer-rpg) | `RPG Male Adventurer/attackbig3.wav` | [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/) |
| `pro-shout_02.mp3` | [Voice Clip Pack - Male Adventurer RPG](https://opengameart.org/content/voice-clip-pack-male-adventurer-rpg) | `RPG Male Adventurer/attackbig4.wav` | [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/) |
| `pro-shout_03.mp3` | [Voice Clip Pack - Male Adventurer RPG](https://opengameart.org/content/voice-clip-pack-male-adventurer-rpg) | `RPG Male Adventurer/attackbig5.wav` | [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/) |

Download: [RPG Male Adventurer.zip](https://opengameart.org/sites/default/files/RPG%20Male%20Adventurer.zip). Archive SHA-256: `eb874f027758ccf9eca0449d09dc3220dc44eb4095e8b0da93351d276e176f7f`.

## Processing

FFmpeg decoded the stereo 44.1 kHz PCM sources to mono 48 kHz float PCM. The ranges below retain the active vocal take and remove surrounding silence. Each was scaled to a pre-encode peak of −3 dBFS, faded in over 5 ms and out over 30 ms, and encoded as a 192 kbps MP3. No pitch change, added reverberation, spatial positioning, or synthesized replacement was used. No existing project audio was modified.

| Delivered file | Range in source (seconds) | Gain after mono conversion | Decoded duration | Bytes |
| --- | --- | --- | --- | --- |
| `egg-scream_01.mp3` | 0.595–1.250 | −4.059854 dB | 0.655 s | 17,324 |
| `pro-shout_01.mp3` | 0.015–0.310 | −6.095531 dB | 0.295 s | 8,684 |
| `pro-shout_02.mp3` | 0.025–0.380 | −6.091483 dB | 0.355 s | 9,836 |
| `pro-shout_03.mp3` | 0.005–0.540 | −6.119187 dB | 0.535 s | 14,444 |

The takes are selected from the original pack's `attackbig` recordings. Their suitability as the fan scream and player shouts still needs an audible review in the scene; the available agent tool did not support audio input. Numeric validation does not establish subjective sound quality or browser synchronization.

## SHA-256

| Original archive entry | SHA-256 of unmodified WAV |
| --- | --- |
| `attackbig0.wav` | `93254d118fdfb1dac17e9b76dc7f57ad847654818cd10ba5f8630c5e4a14026a` |
| `attackbig3.wav` | `026d596cbafdd730e33422243010d63cc73088746e817bd89660201ca4a2506f` |
| `attackbig4.wav` | `05679adb1522e4e656d9e66fc9b6bd343538fb2968edd37492733f2f8b1255c1` |
| `attackbig5.wav` | `98c53fabbe6c7f584ee7164ed5c0407adbd4812b837c1c0ef90818025ff3ed7c` |

| Delivered file | SHA-256 |
| --- | --- |
| `egg-scream_01.mp3` | `940da8fb6c13e5e0d4e47af6779dc25dc41f91564a675b97ff12449f0c2d050b` |
| `pro-shout_01.mp3` | `f957237881e1cd1ba9c8520b62d83132986ae10e5d7f27f3e168bf9ee3f4e0ae` |
| `pro-shout_02.mp3` | `eb147214d664b24347b3e307f30deea0e1adf403dcbaaebba932f178b341f631` |
| `pro-shout_03.mp3` | `474b4f501679437f3603e1d7c72a32b5d9a5b503e6df57929246b843f32ed2cd` |


## FX1 emote additions — 2026-11-13

User assets were checked first: `brain assets find --kind media --limit 5 --json` returned `the asset cards are not built yet`. The workspace contained only the four existing SFX above; none was overwritten. These additions use downloaded CC0 assets; no paid service, generated voice, account, or runtime dependency was used.

- [58 Random Sound Effects](https://opengameart.org/content/58-random-sound-effects), TokyoGeisha: the author lists CC0; three hand-clap recordings plus crunch/pop recordings. [Archive](https://opengameart.org/sites/default/files/Sound%20Effects.zip), SHA-256 `ab3e404ff218e983f1a7564e39073e254a1052d075cfb667b5206c3ff8a031c0`.
- [Magic Spell SFX](https://opengameart.org/content/magic-spell-sfx), JaggedStone: the author lists CC0; `magical_1.ogg`, `magical_2.ogg`, `magical_3.ogg` (first download basename is `magical_1_0.ogg`).
- [Voice Clip Pack - Male Adventurer RPG](https://opengameart.org/content/voice-clip-pack-male-adventurer-rpg), wolfwoot / Brandon Song: CC0; separate recorded attack vocalizations, not synthetic replacement. [Archive](https://opengameart.org/sites/default/files/RPG%20Male%20Adventurer.zip), SHA-256 `eb874f027758ccf9eca0449d09dc3220dc44eb4095e8b0da93351d276e176f7f`.
- License for all additions: [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/). Source declarations checked on 2026-11-13.

FFmpeg converts to mono 48 kHz. Trim starts 5 ms before the first sample above max(0.002, source peak x 0.015), ends at the last such sample +30 ms, and is capped per file below. Each result has 5 ms fade-in, 30 ms fade-out, a pre-fade peak target of -3 dBFS, and 192 kbps MP3 encoding. Egg impact combines crunch x1 and pop x0.65 with their trimmed starts aligned. No pitch, reverb, or baked stereo placement is added. All variants are distinct recordings.

| Delivered file | Original file and source | License | Source range used | Gain after mix | Decoded duration | Bytes | Delivered SHA-256 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `cheer-clap_01.mp3` | [Hand_Clap_01.wav](https://opengameart.org/content/58-random-sound-effects) x 1 | CC0 1.0 | Hand_Clap_01.wav: 0.000000–0.086813 s | -4.459 dB | 0.086813 s | 3500 | `c2c8f06e4c0b5ec2a8be8e51c42185adc1b149fb2fa0d606338cc109b04f2520` |
| `cheer-clap_02.mp3` | [Hand_Clap_02.wav](https://opengameart.org/content/58-random-sound-effects) x 1 | CC0 1.0 | Hand_Clap_02.wav: 0.000000–0.094937 s | -6.329 dB | 0.094937 s | 3500 | `3f9837fe3bdb13e77ca7e62951c6401e94653a1e22ca89456fc426100fbb53c3` |
| `cheer-clap_03.mp3` | [Hand_Clap_03.wav](https://opengameart.org/content/58-random-sound-effects) x 1 | CC0 1.0 | Hand_Clap_03.wav: 0.000000–0.170625 s | -5.699 dB | 0.170625 s | 5804 | `648aefc77ec9ad497eca9edf0405972bc5bf8f75576c968ba51c571eeb108e77` |
| `heart-pop_01.mp3` | [magical_1_0.ogg](https://opengameart.org/content/magic-spell-sfx) x 1 | CC0 1.0 | magical_1_0.ogg: 0.015229–0.565229 s | 6.778 dB | 0.550000 s | 14444 | `e10ad1acfe79e4bf654d9c2f0be59dbaba190e2739d3efb27189e59fb2c4b592` |
| `heart-pop_02.mp3` | [magical_2.ogg](https://opengameart.org/content/magic-spell-sfx) x 1 | CC0 1.0 | magical_2.ogg: 0.000000–0.550000 s | 9.537 dB | 0.550000 s | 14444 | `13725cde2f0a14c4fd6fc60acaba36bd0cfde7492d16ed9b6dc9685650d40475` |
| `heart-pop_03.mp3` | [magical_3.ogg](https://opengameart.org/content/magic-spell-sfx) x 1 | CC0 1.0 | magical_3.ogg: 0.000000–0.550000 s | 1.489 dB | 0.550000 s | 14444 | `bf06a14e5f491f27ef6ee8449c960605ca1b750f646dd7e300bc912b9978a3c0` |
| `angry-voice_01.mp3` | [RPG Male Adventurer/attackbig1.wav](https://opengameart.org/content/voice-clip-pack-male-adventurer-rpg) x 1 | CC0 1.0 | RPG Male Adventurer/attackbig1.wav: 0.037583–0.787583 s | -6.305 dB | 0.750000 s | 19628 | `d0021fbcec8e7b900a26dcd5451c7adc0931a5d0e78794f785caeb9ee25e1c74` |
| `angry-voice_02.mp3` | [RPG Male Adventurer/attackbig2.wav](https://opengameart.org/content/voice-clip-pack-male-adventurer-rpg) x 1 | CC0 1.0 | RPG Male Adventurer/attackbig2.wav: 0.033688–0.628042 s | -6.169 dB | 0.594354 s | 15596 | `ed41b0363076e3ded648ea3b940e3388c8851504c9e5649d1c14a168846bf605` |
| `angry-voice_03.mp3` | [RPG Male Adventurer/attack0.wav](https://opengameart.org/content/voice-clip-pack-male-adventurer-rpg) x 1 | CC0 1.0 | RPG Male Adventurer/attack0.wav: 0.003312–0.198687 s | -6.005 dB | 0.195375 s | 6380 | `e9e42bd1508546123477d389d54ce96639b6546be3039cb46db21e4eeda680cc` |
| `egg-impact_01.mp3` | [Crunch_01.wav](https://opengameart.org/content/58-random-sound-effects) x 1 + [Pop_01.wav](https://opengameart.org/content/58-random-sound-effects) x 0.65 | CC0 1.0 | Crunch_01.wav: 0.009167–0.375000 s; Pop_01.wav: 0.000000–0.114917 s | -6.738 dB | 0.365833 s | 10412 | `70762e046d5cf97ee436405bc46402b25d2b4fa9e5044a38439c639593487e28` |
| `egg-impact_02.mp3` | [Crunch_02.wav](https://opengameart.org/content/58-random-sound-effects) x 1 + [Pop_02.wav](https://opengameart.org/content/58-random-sound-effects) x 0.65 | CC0 1.0 | Crunch_02.wav: 0.000000–0.400000 s; Pop_02.wav: 0.000000–0.090021 s | -6.235 dB | 0.400000 s | 10988 | `537655ff9fc787e849c9312c98c67a366282c5889621c5308abee8afc4021f93` |
| `egg-impact_03.mp3` | [Crunch_03.wav](https://opengameart.org/content/58-random-sound-effects) x 1 + [Pop_01.wav](https://opengameart.org/content/58-random-sound-effects) x 0.65 | CC0 1.0 | Crunch_03.wav: 0.000000–0.400000 s; Pop_01.wav: 0.000000–0.114917 s | -5.041 dB | 0.400000 s | 10988 | `1b4d04c36a84469d8ecf7c43365907c7c6bdbfc474aa4b34c1979f61f74e9b44` |

### FX1 original audio SHA-256

| Original download / archive entry | SHA-256 |
| --- | --- |
| `Hand_Clap_01.wav` | `08c74ae981b437d64cd0c048d22721e4a67563efe3c5c71097ac230db3674a66` |
| `Hand_Clap_02.wav` | `08ac16c9ef79282c54e7ad12df4c9c07259bd6ac0e5f98e31c86817c513a3d0b` |
| `Hand_Clap_03.wav` | `8197d37cfd3932fe6603f1bdfae6327d704fe37f034c4a5f581c6411573bb305` |
| `magical_1_0.ogg` | `119f9061a566c72c1c58444b03f8685b833079ef268dda02fe742eb34d3bc68f` |
| `magical_2.ogg` | `84a70f63f3f21e5ba4a48285b760a663d422ad3feddba2f3cbadd94b76cdc52e` |
| `magical_3.ogg` | `9fac648a1de869cf9ca2f4b3f1cd47f1766a3ee9d2fdec45831234401d7b2392` |
| `RPG Male Adventurer/attackbig1.wav` | `a8c74fc1f04f8619263c85cf8cc32ea264ba9ef5a7122650f4a90339f694bc6b` |
| `RPG Male Adventurer/attackbig2.wav` | `7fb7582565945efd5c8722bc6a7ed858086850c0fb93c58e9ca2836a08b52930` |
| `RPG Male Adventurer/attack0.wav` | `01f4adfff1d7a5f7be27b6d63041708d8fd01d43d6847f8527b991828bf6382b` |
| `Crunch_01.wav` | `7c24fa33f68af07566544915801372c8c7f05516caba354faab2d3a46129f81c` |
| `Pop_01.wav` | `ee8e565faac399495e3e2d90705df539e971a600ca5fbd8c4dd28f8da7bfcd83` |
| `Crunch_02.wav` | `96d6ca828e441e12fb4502af3f0ce8ceb8347dcaab0c71c7e74ad551fed0a3ad` |
| `Pop_02.wav` | `de1739dc4d0271d42f0cc2df6d686883062e4e4547332dffc8a8888b778cfa6e` |
| `Crunch_03.wav` | `60fca71d63c0222d4d1385982ab94d2dc26a0bad48951ec3d9226d56a36130ca` |

Numeric decoding and peak checks passed; listening in the actual scene is still required. Angry files are selected from human attack vocalizations as a short frustrated grunt, and the egg impact is a stylized crunch/pop rather than a recording of an egg. These are the intended mappings, not an assertion of listening approval.


## T78 cheer / whistle replacement — 2026-11-14 (current)

This section supersedes **only the three `cheer-clap_01.mp3`–`03.mp3` rows** in the historical FX1 table above. The current files contain a crowd cheer with foreground whistles and quiet hand claps. All other FX1 audio remains unchanged. Playback filenames, `web/character.js` gain `0.3`, and interval `0.12` are unchanged.

### Sources and permission

- **Crowd:** [Crowd Cheering](https://freesound.org/people/SoundsExciting/sounds/365132/) by **SoundsExciting**, sound ID 365132. The creator describes cheering and wooing with applause; the original page declares [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/). Checked 2026-11-14. Used the publicly served [HQ MP3 preview](https://cdn.freesound.org/previews/365/365132_3279490-hq.mp3), not a claim of downloading the original WAV. Download SHA-256: `87bab1996436dbaa7c37c676aca2622feb695802bfc1e10eff47a520c72ff381` (305864 bytes). Page evidence: `temp/T78/crowd-source.html`.
- **Whistles:** directly synthesized for T78 with sine waves, smooth pitch bends, vibrato, a faint second harmonic and seeded breath noise; no sampled whistle, voice model, paid service, or account. Reproduction: `temp/T78/build.py`. Base pitches are 2020 / 2230 / 1870 Hz; each variant contains three overlapping whistle gestures.
- **Quiet hand claps:** reuse of the backed-up FX1 files, from [58 Random Sound Effects](https://opengameart.org/content/58-random-sound-effects) by **TokyoGeisha**, `Hand_Clap_01.wav`–`03.wav`, CC0. Source page and CC0 link rechecked 2026-11-14; `temp/T78/handclap-source.html`. Original archive and WAV hashes remain in the FX1 section. Pre-replacement MP3s are preserved byte-for-byte in `_workspace/_run/2026-11-13-ux-motion-rooms/bak/T78/`.

### Processing

Offline FFmpeg / Python only; no added web dependency. Mono 48 kHz, 192 kbps MP3. Each variant layers two different excerpts from the crowd recording, the second at x0.65 before normalization. Crowd high-pass 180 Hz, low-pass 3800 Hz, +3 dB broad EQ at 1150 Hz, compressor threshold 0.09 / ratio 5 / attack 0.5 ms / release 65 ms. The synthesized whistle layer is about 2.5–2.6 dB below the crowd layer in RMS. The added hand-clap layer is 23.4–25.1 dB below the whistle layer and 26.1–27.6 dB below the crowd; the crowd source itself also contains applause.

The mix uses a compressor (threshold 0.14, ratio 6, attack 0.5 ms, release 50 ms, makeup x5), a 192 kHz oversampled look-ahead limiter (ceiling 0.82, attack 3 ms, release 25 ms), short entrance fades and a 45 ms final fade. The final MP3 is re-decoded and checked for sample peaks and true peaks; encode gain corrections are +0.4 / +0.3 / +0.4 dB. This increases sustained energy instead of relying only on a louder hand-clap transient. No baked stereo positioning or extra reverb.

The original runtime interrupts the previous sound at each clap cue (currently about 0.267–0.333 seconds apart); the first 240 ms already contain the cheer and whistle. The 1.04–1.16 second full files retain a natural tail if allowed to complete. This asset task does not change that playback behavior.

| Current file | Crowd source ranges (s) | Decoded duration (s) | LUFS-I* | Sample peak dBFS | True peak dBTP | Bytes | SHA-256 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `cheer-clap_01.mp3` | 0.70–1.74 + 4.20–5.24 | 1.04 | -8.0 | -1.55 | -1.5 | 26540 | `417315f4e5d8e7e2c5c5f32c083de366b4638da716ba3eab4ee65fc4d0965303` |
| `cheer-clap_02.mp3` | 3.15–4.25 + 7.10–8.20 | 1.10 | -8.0 | -1.64 | -1.6 | 27692 | `208337be2b81a75e5c5c25e13fd80ac0358beae49c25a2141528e64a1b0e7822` |
| `cheer-clap_03.mp3` | 5.80–6.96 + 9.00–10.16 | 1.16 | -8.1 | -1.55 | -1.6 | 29420 | `5b4ef86bd770a6ea2ebcb1107c2d3fc87b9b5bc6a968a5b7b6fe43063582702b` |

*FFmpeg EBU R128 integrated loudness; clips shorter than 1 s are padded to 1 s for the old/new/comparison measurement. Current T78 files are all longer than 1 s. All current decoded samples are strictly inside ±1. Measurement and processing details: `temp/T78/metrics-green.json`, `temp/T78/processing.json`; report: `_workspace/graphicmodel/2026-11-13-ux-motion-rooms/21_graphic-effect-vfx-designer_cheer-sound_v1.md`. These are numeric checks, not an assertion of subjective listening approval.

## T82 sustained angry screams — 2026-11-14 (current)

This section supersedes **only the three `angry-voice_01.mp3`–`03.mp3` rows** in the historical FX1 table. Each current file is a distinct recorded human scream extended to **4.800 seconds**, the T81 `Emote_Angry` clip length. Playback filenames, `web/character.js` gain `0.32`, and interval `0.75` remain unchanged. Originals, the previous source record, and the character configuration were copied to `_workspace/_run/2026-11-13-ux-motion-rooms/bak/T82/` before replacement and checked by SHA-256.

### Sources and permission

All three recordings are by **JohnsonBrandEditing / Brian R. Johnson**. Each creator page explicitly declares [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/); checked 2026-11-14. Public HQ MP3 previews were downloaded; no claim is made of obtaining the login-only original downloads. No account, paid source, voice model, or paid generation was used.

| Current file | Creator page | Public HQ preview | Download bytes | Download SHA-256 |
| --- | --- | --- | --- | --- |
| `angry-voice_01.mp3` | [human male scream 1](https://freesound.org/people/JohnsonBrandEditing/sounds/243377/) | [243377 HQ MP3](https://cdn.freesound.org/previews/243/243377_3229685-hq.mp3) | 122976 | `09e4672133fb3492c91957970fd98eb1fa4f6e2bd365760d91ba5f50a8a51886` |
| `angry-voice_02.mp3` | [human male scream 3](https://freesound.org/people/JohnsonBrandEditing/sounds/243381/) | [243381 HQ MP3](https://cdn.freesound.org/previews/243/243381_3229685-hq.mp3) | 80952 | `2a3df23e6e93cfc1fdd87c06528fbade7f30511671667f7953b7cbc294191978` |
| `angry-voice_03.mp3` | [human male scream 4](https://freesound.org/people/JohnsonBrandEditing/sounds/243380/) | [243380 HQ MP3](https://cdn.freesound.org/previews/243/243380_3229685-hq.mp3) | 66480 | `be42082ff65fde247e77574fcf6d39050359316c5bcd15769e0c61e53eb4ccfa` |

Page evidence is `temp/T82/source-<sound ID>.html`; downloaded audio is `source-<sound ID>.mp3` in the same folder. `downloads.json` records the URLs, license, byte counts, and hashes.

### Processing

Offline FFmpeg and Python only, with the already installed Rubber Band filter; no web dependency was added. Mono 48 kHz / 192 kbps MP3. Each take is cropped to its sustained vocal portion, stretched with smooth transients and preserved formants, then trimmed to 4.8 s. There are no repeated scream onsets or appended silent seconds. Pitch multipliers are small deliberate variations, not imitations of another person.

| Current file | Source range (s) | Tempo multiplier | Pitch multiplier | Gain before compressor |
| --- | --- | --- | --- | --- |
| `angry-voice_01.mp3` | 0.245–3.080 | 0.585744 | 0.94 | ×5.222487 |
| `angry-voice_02.mp3` | 0.130–1.920 | 0.369835 | 1.00 | ×10.993925 |
| `angry-voice_03.mp3` | 0.260–1.680 | 0.293388 | 0.97 | ×3.375995 |

The chain uses a 90 Hz high-pass, 6.5 kHz low-pass, broad +2 dB EQ at 1450 Hz, compressor (threshold 0.12 / ratio 4 / attack 3 ms / release 70 ms / makeup ×2), 8 ms entrance and 50 ms final fades, loudness processing, and a 192 kHz look-ahead limiter (ceiling 0.81 / attack 3 ms / release 35 ms). Exact filters and gain values are in `temp/T82/processing.json`; reproduction is `python -B temp/T82/build.py`. No baked stereo placement or reverb was added.

| Current file | Decoded duration (s) | LUFS-I* | RMS dBFS | Sample peak dBFS | True peak dBTP | Bytes | Delivered SHA-256 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `angry-voice_01.mp3` | 4.800 | -9.3 | -9.65 | -2.08 | -2.1 | 116396 | `8f0601cba54be9b1f270f36b1b72e5ba43a924568427cda6a0e6c9b43005efab` |
| `angry-voice_02.mp3` | 4.800 | -8.0 | -8.74 | -2.05 | -2.1 | 116396 | `4f60c6239d718bde124ca035f4f5c886921a06a2f369a2c78698840efa8cdfe7` |
| `angry-voice_03.mp3` | 4.800 | -9.2 | -9.77 | -2.04 | -2.0 | 116396 | `5222bdeac518a729bbae9458491ea2f6bd88452bb82da8986d6b5ceff5c739d3` |

*Same `apad=whole_dur=1,ebur128=peak=true` comparison method as T78. The new files require no padding. Re-decoded MP3s have zero clipped samples; the quietest interior 100 ms RMS windows are -11.00 / -10.60 / -12.82 dBFS. These numeric checks do not establish subjective listening approval.

Runtime limitation: the first `angry_swing` starts audio at frame 22 / 0.733 s and clip completion stops it at about 4.8 s. Thus the current code plays approximately 4.067 s of each 4.8 s asset; T82 did not alter this behavior. The screen's mute and user-volume controls are shared, while current positional-audio distance attenuation differs from the screen's 25–90 m curve. Details and recommendations: `_workspace/graphicmodel/2026-11-13-ux-motion-rooms/25_graphic-effect-vfx-designer_angry-scream_v1.md`.
