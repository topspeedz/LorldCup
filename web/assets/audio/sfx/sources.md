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
