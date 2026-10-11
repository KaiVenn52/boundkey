"""Record real standalone Android app interactions; offline demo only."""
import pathlib
import os
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET

out = pathlib.Path(os.environ.get('BOUNDKEY_RECORD_OUT', 'submission/android-evidence'))
out.mkdir(parents=True, exist_ok=True)

def adb(*args):
    return subprocess.check_output([os.environ.get('ADB', 'adb'), *args], stderr=subprocess.STDOUT)

def screenshot(name):
    (out / f'{name}.png').write_bytes(adb('exec-out', 'screencap', '-p'))

def nodes():
    adb('shell', 'uiautomator', 'dump', '/sdcard/boundkey-ui.xml')
    return ET.fromstring(adb('shell', 'cat', '/sdcard/boundkey-ui.xml')).iter('node')

def tap(label):
    for _ in range(10):
        for node in nodes():
            if label in (node.get('text', '') + node.get('content-desc', '')):
                x1, y1, x2, y2 = map(int, re.findall(r'\d+', node.get('bounds', '')))
                if y2 > y1 and x2 > x1:
                    adb('shell', 'input', 'tap', str((x1+x2)//2), str((y1+y2)//2))
                    time.sleep(2)
                    return
        adb('shell', 'input', 'swipe', '540', '1700', '540', '600', '500')
        time.sleep(1)
    screenshot('failed-ui')
    raise RuntimeError(f'Control not found: {label}')

adb('install', '-r', sys.argv[1])
adb('shell', 'settings', 'put', 'system', 'show_touches', '1')
adb('shell', 'am', 'force-stop', 'com.kaivenn.boundkey')
adb('shell', 'am', 'start', '-n', 'com.kaivenn.boundkey/.MainActivity')
time.sleep(18)
screenshot('01-home')
scrcpy = os.environ.get('BOUNDKEY_SCRCPY_PATH')
if scrcpy:
    record = subprocess.Popen([scrcpy, '--no-window', '--no-playback', '--no-audio', '--time-limit=120', f'--record={out / "boundkey-android-offline-demo.mp4"}'])
else:
    record = subprocess.Popen([os.environ.get('ADB', 'adb'), 'shell', 'screenrecord', '--bit-rate', '8000000', '--time-limit', '120', '/sdcard/boundkey-demo.mp4'])
try:
    time.sleep(7)
    tap('Run safe offline demo')
    screenshot('02-active')
    time.sleep(6)
    for _ in range(3):
        tap('Generate next paid voucher')
        time.sleep(4)
    screenshot('03-usage')
    tap('Try $5 attack')
    screenshot('04-cap-blocked')
    time.sleep(9)
    tap('Change payee')
    screenshot('05-payee-blocked')
    time.sleep(9)
    tap('End capability')
    screenshot('06-ended')
    time.sleep(5)
finally:
    record.wait(timeout=130)
    if not scrcpy:
        adb('pull', '/sdcard/boundkey-demo.mp4', str(out / 'boundkey-android-offline-demo.mp4'))
    pid = adb('shell', 'pidof', 'com.kaivenn.boundkey').decode().strip().split()[0]
    (out / 'logcat.txt').write_bytes(adb('logcat', '-d', f'--pid={pid}'))
    (out / 'device.txt').write_bytes(adb('shell', 'getprop', 'ro.product.model') + adb('shell', 'getprop', 'ro.build.version.release'))
    (out / 'ui.xml').write_bytes(adb('shell', 'cat', '/sdcard/boundkey-ui.xml'))
