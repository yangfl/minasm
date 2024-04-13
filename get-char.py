#!/usr/bin/env python3

import itertools
from typing import *


def grouper(iterable, n, *, incomplete='fill', fillvalue=None):
    "Collect data into non-overlapping fixed-length chunks or blocks"
    # grouper('ABCDEFG', 3, fillvalue='x') --> ABC DEF Gxx
    # grouper('ABCDEFG', 3, incomplete='strict') --> ABC DEF ValueError
    # grouper('ABCDEFG', 3, incomplete='ignore') --> ABC DEF
    args = [iter(iterable)] * n
    if incomplete == 'fill':
        return itertools.zip_longest(*args, fillvalue=fillvalue)
    if incomplete == 'strict':
        return zip(*args, strict=True)
    if incomplete == 'ignore':
        return zip(*args)
    else:
        raise ValueError('Expected fill, strict, or ignore')


def charpoint(data : str) -> Tuple[int, List[str]]:
    if not data.startswith('STARTCHAR'):
        return 0, []
    bitmap = data.split('BITMAP\n', 1)[1].split('\n')[:-1]
    for line in data.split('\n'):
        if line.startswith('ENCODING'):
            return int(line.split(' ', 1)[1]), bitmap


handler_name = 'writeChar'

with open('vendor/12x12.bdf') as f:
    bitmaps = dict(charpoint(c) for c in f.read().split('\n\n') )

while True:
    try:
        text = input('> ')
    except EOFError:
        break
    if not text:
        break

    chars : List[str] = []
    success = True
    for c in text:
        if ord(c) not in bitmaps:
            print('Unknown character:', c)
            success = False
            break
        if c not in chars:
            chars.append(c)
    if not success:
        continue

    for c in text:
        print(f'.int _{handler_name}_{c} {handler_name}  # {hex(ord(c))}')
    # print('.int waitChars')
    print('end\n\n')

    for c in chars:
        print(f'.label _{handler_name}_{c}')
        bitmap = [row[:3].rjust(3, '0') for row in bitmaps[ord(c)]]
        if len(bitmap) < 12:
            bitmap = ['000'] * (12 - len(bitmap)) + bitmap
        for i, d in enumerate(grouper(bitmap, 4, fillvalue='000')):
            print('dataPixel', i + 1, ' = 0x', *d, sep='')
        print(f'jump {handler_name}\n')
