"""Generate the original Hacker Toes 6.0 starter sound library.

Requires Python 3 and NumPy. The generated WAVs are original procedural audio,
not samples taken from copyrighted recordings. Re-running this script replaces
only files whose names begin with `ht6-` and rewrites data/sound-library-index.json.
"""
from __future__ import annotations
import json, math, os, random, struct, uuid, wave
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
SOUND_DIR = ROOT / 'data' / 'sounds'
INDEX = ROOT / 'data' / 'sound-library-index.json'
SAMPLE_RATE = 44_100
DURATION = 5.0
COUNT_PER_CATEGORY = 100

CATEGORIES = {
    'Arcade': ['Coin pickup', 'Level-up fanfare', 'Bonus chime', 'Game over', 'Laser shot', 'Power-up sparkle', 'Menu blip', 'Victory jingle', 'Combo burst', 'Retro jump'],
    'Comedy': ['Rubber boing', 'Cartoon pop', 'Spring twang', 'Wobble whistle', 'Slide whistle', 'Squeaky bounce', 'Plucky honk', 'Bouncy wobble', 'Funny fall', 'Tiny fanfare'],
    'Interface': ['Soft click', 'Confirm chime', 'Alert double-beep', 'Message pop', 'Error pulse', 'Toggle switch', 'Gentle notification', 'Success sparkle', 'Button tap', 'Short attention tone'],
    'Sci-Fi': ['Power core', 'Warp sweep', 'Scanner pulse', 'Plasma burst', 'Synth drone', 'Energy charge', 'Portal shimmer', 'Engine startup', 'Digital transmission', 'Ion ripple'],
    'Impacts': ['Bass thump', 'Metallic impact', 'Cinematic hit', 'Deep knock', 'Hollow impact', 'Heavy pulse', 'Bright strike', 'Low boom', 'Resonant hit', 'Short rumble'],
    'Alarms': ['Warning beacon', 'Rising alarm', 'Pulse alert', 'Countdown beep', 'Siren sweep', 'Two-tone warning', 'Urgent signal', 'Repeating alert', 'Soft alarm', 'High-low beacon'],
    'Transitions': ['Fast whoosh', 'Bright riser', 'Reverse sweep', 'Impact transition', 'Short shimmer', 'Airy pass-by', 'Digital sweep', 'Falling transition', 'Wide whoosh', 'Sparkle reveal'],
    'Percussion': ['Electronic kick', 'Snare pop', 'Digital clap', 'Low tom roll', 'Cymbal wash', 'Tight rim hit', 'Deep drum pulse', 'Bright tick', 'Percussive burst', 'Short drum fill'],
    'Ambience': ['Night drone', 'Space ambience', 'Digital hum', 'Wind-like wash', 'Warm atmosphere', 'Subtle machine room', 'Dreamy pad', 'Deep underwater tone', 'Distant shimmer', 'Soft cosmic bed'],
    'Signals': ['Sonar ping', 'Radio chirp', 'Morse burst', 'Beacon pulse', 'Radar sweep', 'Echo marker', 'Navigation ping', 'Data packet', 'Signal handshake', 'Repeating locator'],
}

N = int(SAMPLE_RATE * DURATION)
t = np.arange(N, dtype=np.float32) / SAMPLE_RATE
fade_in = np.minimum(1.0, t / 0.018)
fade_out = np.minimum(1.0, (DURATION - t) / 0.20)
edge = fade_in * np.maximum(0.0, fade_out)

def envelope(rng, family):
    attack = rng.uniform(0.008, 0.25)
    decay = rng.uniform(0.35, 2.8)
    sustain = rng.uniform(0.15, 0.75)
    a = np.minimum(1.0, t / attack)
    d = np.exp(-np.maximum(0.0, t - attack) / decay)
    if family in ('Ambience', 'Sci-Fi'):
        slow = 0.62 + 0.25 * np.sin(2*np.pi*rng.uniform(.08,.8)*t + rng.uniform(0,6.28))
        return (a * (sustain + (1-sustain)*d) * slow).astype(np.float32)
    return (a * d).astype(np.float32)

def make_audio(seed: int, family: str) -> np.ndarray:
    rng = np.random.default_rng(seed)
    f0 = float(rng.uniform(75, 1500))
    phase = float(rng.uniform(0, 2*np.pi))
    env = envelope(rng, family)
    mix = np.zeros(N, dtype=np.float32)
    vibrato_rate = float(rng.uniform(1.2, 9.0))
    vibrato_depth = float(rng.uniform(.002, .045))
    sweep = float(rng.uniform(-1.0, 1.0))

    if family == 'Arcade':
        rate = rng.uniform(.12,.42)
        steps = np.floor(t / rate).astype(np.int32)
        scale = np.array([1.0, 1.125, 1.25, 1.5, 1.333, 1.75, 2.0, 1.6], dtype=np.float32)
        if rng.random() < .5: scale = scale[::-1].copy()
        freq = f0 * scale[steps % len(scale)]
        ph = 2*np.pi*np.cumsum(freq)/SAMPLE_RATE + phase
        mix += (.56*np.sin(ph) + .21*np.sin(2*ph) + .10*np.sin(3*ph)) * env
        mix += rng.normal(0,.16,N).astype(np.float32) * np.exp(-t*7) * (np.sin(2*np.pi*rate*t)>.65)
    elif family == 'Comedy':
        glide = 1.0 + .75*np.sin(2*np.pi*(rng.uniform(.12,.5))*t + phase)*np.exp(-t*rng.uniform(.35,1.2))
        freq = np.maximum(45, f0*glide*(1 + .025*np.sin(2*np.pi*vibrato_rate*t)))
        ph = 2*np.pi*np.cumsum(freq)/SAMPLE_RATE + phase
        mix += (.48*np.sin(ph) + .20*np.sin(2.03*ph) + .12*np.sin(.51*ph)) * env
        noise = rng.normal(0,.23,N).astype(np.float32)
        mix += noise * np.exp(-t*rng.uniform(1.5,5.0)) * .35
    elif family == 'Interface':
        freq = f0 * (1 + .06*np.sin(2*np.pi*5*t))
        ph = 2*np.pi*np.cumsum(freq)/SAMPLE_RATE + phase
        gate = (np.sin(2*np.pi*rng.uniform(1.1,3.7)*t + phase)>.1).astype(np.float32)
        mix += (.38*np.sin(ph) + .14*np.sin(2.7*ph))*env*(.45+.55*gate)
        mix += rng.normal(0,.24,N).astype(np.float32)*np.exp(-t*18)*.55
    elif family == 'Sci-Fi':
        freq = f0 * np.exp(sweep*t*rng.uniform(.15,.75)) * (1 + vibrato_depth*np.sin(2*np.pi*vibrato_rate*t))
        ph = 2*np.pi*np.cumsum(freq)/SAMPLE_RATE + phase
        mix += (.34*np.sin(ph) + .20*np.sin(1.503*ph) + .13*np.sin(2.71*ph))*env
        noise = rng.normal(0,.22,N).astype(np.float32)
        mix += noise*(.13 + .12*np.sin(2*np.pi*rng.uniform(.2,1.1)*t))
    elif family == 'Impacts':
        drop = np.exp(-t*rng.uniform(1.0,4.0))
        freq = f0*np.exp(-t*rng.uniform(1.0,3.5))
        ph = 2*np.pi*np.cumsum(freq)/SAMPLE_RATE + phase
        mix += (.65*np.sin(ph) + .17*np.sin(2.4*ph))*drop
        noise = rng.normal(0,.40,N).astype(np.float32)
        mix += noise*np.exp(-t*rng.uniform(3.0,8.0))*.48
        mix += .10*np.sin(2*np.pi*(f0*.47)*t)*np.exp(-t*1.2)
    elif family == 'Alarms':
        pulse = (np.sin(2*np.pi*rng.uniform(.6,2.0)*t + phase)>-.15).astype(np.float32)
        alternator = np.where((np.floor(t*rng.uniform(1.5,3.0)).astype(int)%2)==0,1.0,1.35)
        freq = f0*alternator
        ph = 2*np.pi*np.cumsum(freq)/SAMPLE_RATE + phase
        mix += (.52*np.sin(ph)+.16*np.sin(2*ph))*pulse*env
        mix += rng.normal(0,.12,N).astype(np.float32)*pulse*np.exp(-t*3)*.25
    elif family == 'Transitions':
        center = np.clip((t/DURATION)**rng.uniform(.35,1.8),0,1)
        noise = rng.normal(0,.42,N).astype(np.float32)
        sweep_env = np.sin(np.pi*center)**rng.uniform(.45,1.8)
        freq = f0*(.45+2.7*center)
        ph = 2*np.pi*np.cumsum(freq)/SAMPLE_RATE + phase
        mix += noise*sweep_env*.56
        mix += (.27*np.sin(ph)+.12*np.sin(2.3*ph))*sweep_env
    elif family == 'Percussion':
        pulse_rate = rng.uniform(1.4,5.0)
        phase_pulse = (t*pulse_rate)%1.0
        pulse = np.exp(-phase_pulse*rng.uniform(8,18))
        freq = f0*np.exp(-phase_pulse*rng.uniform(1.8,4.5))
        ph = 2*np.pi*np.cumsum(freq)/SAMPLE_RATE + phase
        noise = rng.normal(0,.38,N).astype(np.float32)*np.exp(-phase_pulse*14)
        mix += (.58*np.sin(ph)+.20*np.sin(2*ph))*pulse + .32*noise
    elif family == 'Ambience':
        for k in range(4):
            ratio = [1.0,1.25,1.5,2.01][k]
            slow = .08 + .10*np.sin(2*np.pi*rng.uniform(.03,.28)*t+rng.uniform(0,6.28))
            mix += (.15 + .035*k)*np.sin(2*np.pi*f0*ratio*t + rng.uniform(0,6.28))* (1+slow)
        texture = rng.normal(0,.23,N).astype(np.float32)
        # Smoothed noise texture, without external audio libraries.
        texture[1:] = .72*texture[1:] + .28*texture[:-1]
        mix += texture*.30*env
    else:  # Signals
        pulse_rate = rng.uniform(.8,2.4)
        phase_pulse = (t*pulse_rate)%1.0
        ping = np.exp(-phase_pulse*rng.uniform(7,16))
        glide = f0*(1 + .25*np.sin(2*np.pi*rng.uniform(.12,.5)*t))
        ph = 2*np.pi*np.cumsum(glide)/SAMPLE_RATE + phase
        mix += (.60*np.sin(ph)+.16*np.sin(2*ph))*ping
        mix += rng.normal(0,.18,N).astype(np.float32)*ping*.22

    mix *= edge
    # A gentle limiter-like saturation before peak normalization keeps transient layers controlled.
    mix = np.tanh(mix * 1.35)
    peak = float(np.max(np.abs(mix))) or 1.0
    mix = mix / peak * float(rng.uniform(.70,.88))
    # Small independent stereo ambience so the archive has a true stereo image.
    side = rng.normal(0,.018,N).astype(np.float32)
    side *= edge
    left = np.clip(mix + side, -0.98, 0.98)
    right = np.clip(np.roll(mix, int(rng.integers(8,90))) - side, -0.98, 0.98)
    stereo = np.empty((N,2), dtype='<i2')
    stereo[:,0] = (left*32767).astype(np.int16)
    stereo[:,1] = (right*32767).astype(np.int16)
    return stereo


def main():
    SOUND_DIR.mkdir(parents=True, exist_ok=True)
    for old in SOUND_DIR.glob('ht6-*.wav'):
        old.unlink()
    records=[]
    counter=0
    for family, base_names in CATEGORIES.items():
        for i in range(COUNT_PER_CATEGORY):
            counter += 1
            seed = 606000 + counter * 7919
            base = base_names[i % len(base_names)]
            variant = i // len(base_names) + 1
            name = f'{base} {variant:02d}'
            slug = ''.join(ch.lower() if ch.isalnum() else '-' for ch in family).strip('-')
            disk = f'ht6-{slug}-{i+1:03d}.wav'
            audio = make_audio(seed, family)
            path = SOUND_DIR / disk
            with wave.open(str(path),'wb') as out:
                out.setnchannels(2)
                out.setsampwidth(2)
                out.setframerate(SAMPLE_RATE)
                out.writeframes(audio.tobytes())
            records.append({
                'id': str(uuid.uuid5(uuid.NAMESPACE_URL, 'https://hackertoes.bid/ht6/'+disk)),
                'name': name,
                'category': family,
                'size': path.stat().st_size,
                'disk': disk,
            })
        print(f'Generated {family}: {COUNT_PER_CATEGORY} sounds ({counter} total)', flush=True)
    INDEX.write_text(json.dumps(records,indent=2)+'\n', encoding='utf-8')
    total=sum(x['size'] for x in records)
    print(f'Finished {len(records)} original sounds; {total/1_000_000:.1f} MB raw audio.', flush=True)

if __name__ == '__main__':
    main()
