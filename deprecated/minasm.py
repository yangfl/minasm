#!/usr/bin/env python3

import re
from typing import *


SPLIE_ESCAPE_PATTERN = re.compile(r'\s*([^" \t\n\r\f\v]*(?:"(?:\\"|[^"])*")?)')


def split_escape(s):
    return [match.group(1) for match in SPLIE_ESCAPE_PATTERN.finditer(s)
            if match.group(1)]


ARITHMETIC_OP = {
    # core/src/mindustry/logic/LogicOp.java
    '+': 'add',
    '-': 'sub',
    '*': 'mul',
    '/': 'div',
    '//': 'idiv',
    '%': 'mod',
    '**': 'pow',

    '==': 'equal',
    '!=': 'notEqual',
    'and': 'land',
    '&&': 'land',
    '<': 'lessThan',
    '<=': 'lessThanEq',
    '>': 'greaterThan',
    '>=': 'greaterThanEq',
    '===': 'strictEqual',
    '!==': 'strictNotEqual',

    '<<': 'shl',
    '>>': 'shr',
    '|': 'or',
    '&': 'and',
    '^': 'xor',
    '!': 'not',
}


def convert_op(op):
    return ARITHMETIC_OP.get(op, op)


LOGICAL_OP = {
    'equal': 'notEqual',
    'notEqual': 'equal',
    'strictEqual': 'strictNotEqual',
    'strictNotEqual': 'strictEqual',
    'lessThan': 'greaterThanEq',
    'lessThanEq': 'greaterThan',
    'greaterThan': 'lessThanEq',
    'greaterThanEq': 'lessThan',
    'always': 'always',
}


def invert_op(op):
    return LOGICAL_OP.get(op, op)


def minasm_compile(codelines):
    def fatal(lineno, msg):
        raise RuntimeError(f'error at line {lineno + 1}: {msg}')

    def generate_label(lineno, name):
        return [lineno, name, f'..{name}{lineno}', 0]

    def generate_macro_comments(cmds, comments):
        return f'{cmds}  //{comments}' if comments else cmds

    def translate_jump(target, tokens=(), invert=False):
        if not tokens:
            tokens = ['always', 'x', 'false']
        else:
            if tokens[0] not in LOGICAL_OP:
                tokens[0], tokens[1], tokens[2] = \
                    convert_op(tokens[1]), tokens[0], tokens[2]
                if invert:
                    tokens[0] = invert_op(tokens[0])
                if tokens[0] == 'strictNotEqual':
                    tokens[0] = 'strictEqual'
        return ['jump', target, *tokens]

    byte_codelines = []
    control_stack = []
    labels = {}
    for lineno, i in enumerate(codelines):
        # strip comments
        i = i.split('#', 1)
        comments = i[1].rstrip() if len(i) > 1 else ''
        i = i[0]
        # strip empty line
        if not i.strip():
            continue
        # keep indents
        i = i.rstrip()
        cmds = i.lstrip()
        indents = i[:len(i) - len(cmds)]
        tokens = split_escape(cmds)
        if tokens[0].startswith('.') and not tokens[0].startswith('..'):
            # process macro
            if tokens[0] == '.label':
                labels[tokens[1]] = len(byte_codelines)
            # if elif else fi
            elif tokens[0] == '.if':
                this_block = generate_label(lineno, 'if')
                control_stack.append(this_block)
                labels[f'{this_block[2]}start'] = len(byte_codelines)
                byte_codelines.append((
                    lineno, indents,
                    translate_jump(f'{this_block[2]}next{this_block[3]}',
                                   tokens[1:], True),
                    generate_macro_comments(cmds, comments)))
            elif tokens[0] == '.elif':
                this_block = control_stack[-1]
                if this_block[1] != 'if':
                    fatal(lineno, 'unmatched .elif')
                byte_codelines.append((
                    lineno, indents, translate_jump(this_block[2]), comments))
                labels[f'{this_block[2]}next{this_block[3]}'] = \
                    len(byte_codelines)
                this_block[3] += 1
                byte_codelines.append((
                    lineno, indents,
                    translate_jump(f'{this_block[2]}next{this_block[3]}',
                                   tokens[1:], True),
                    generate_macro_comments(cmds, comments)))
            elif tokens[0] == '.else':
                this_block = control_stack[-1]
                if this_block[1] != 'if':
                    fatal(lineno, 'unmatched .else')
                if this_block[3] == -1:
                    fatal(lineno, 'duplicated .else')
                byte_codelines.append((
                    lineno, indents, translate_jump(this_block[2]),
                    generate_macro_comments(cmds, comments)))
                labels[f'{this_block[2]}next{this_block[3]}'] = \
                    len(byte_codelines)
                this_block[3] = -1
            elif tokens[0] == '.fi':
                this_block = control_stack.pop()
                if this_block[1] != 'if':
                    fatal(lineno, 'unmatched .fi')
                labels[f'{this_block[2]}next{this_block[3]}'] = \
                    len(byte_codelines)
                labels[this_block[2]] = len(byte_codelines)
            # while end
            elif tokens[0] == '.while':
                this_block = generate_label(lineno, 'while')
                control_stack.append(this_block)
                labels[f'{this_block[2]}start'] = len(byte_codelines)
                if tokens[1:]:
                    byte_codelines.append((
                        lineno, indents,
                        translate_jump(this_block[2], tokens[1:], True),
                        generate_macro_comments(cmds, comments)))
            elif tokens[0] == '.done':
                this_block = control_stack.pop()
                if this_block[1] != 'while':
                    fatal(lineno, 'unmatched .done')
                byte_codelines.append((
                    lineno, indents, translate_jump(f'{this_block[2]}start'),
                    generate_macro_comments(cmds, comments)))
                labels[this_block[2]] = len(byte_codelines)
            # do when until
            elif tokens[0] == '.do':
                this_block = generate_label(lineno, 'do')
                control_stack.append(this_block)
                labels[f'{this_block[2]}start'] = len(byte_codelines)
            elif tokens[0] == '.when':
                this_block = control_stack.pop()
                if this_block[1] != 'do':
                    fatal(lineno, 'unmatched .when')
                byte_codelines.append((
                    lineno, indents,
                    translate_jump(f'{this_block[2]}start', tokens[1:]),
                    generate_macro_comments(cmds, comments)))
                labels[this_block[2]] = len(byte_codelines)
            elif tokens[0] == '.until':
                this_block = control_stack.pop()
                if this_block[1] != 'do':
                    fatal(lineno, 'unmatched .until')
                if tokens[1:]:
                    byte_codelines.append((
                        lineno, indents,
                        translate_jump(f'{this_block[2]}start', tokens[1:],
                                       True),
                        generate_macro_comments(cmds, comments)))
                labels[this_block[2]] = len(byte_codelines)
            # break continue
            elif tokens[0] == '.break':
                this_block = None
                for i in reversed(control_stack):
                    if i[1] in ['while', 'do']:
                        this_block = i
                        break
                if not this_block:
                    fatal(lineno, 'unbreakable')
                byte_codelines.append((
                    lineno, indents, translate_jump(this_block[2], tokens[1:]),
                    generate_macro_comments(cmds, comments)))
            elif tokens[0] == '.continue':
                this_block = None
                for i in reversed(control_stack):
                    if i[1] in ['while', 'do']:
                        this_block = i
                        break
                if not this_block:
                    fatal(lineno, 'uncontinueable')
                byte_codelines.append((
                    lineno, indents,
                    translate_jump(f'{this_block[2]}start', tokens[1:]),
                    generate_macro_comments(cmds, comments)))
            # sleep
            elif tokens[0] == '.sleep':
                interval = float(tokens[1])
                this_block = generate_label(lineno, 'sleep')
                var_i = f'__sleep{lineno}i'
                var_end = f'__sleep{lineno}end'
                byte_codelines.append((
                    lineno, indents,
                    ['op', 'mul', var_end, str(int(interval * 60 / 2)), '@ipt'],
                    generate_macro_comments(cmds, comments)))
                byte_codelines.append((
                    lineno, indents, ['op', 'sub', var_end, var_end, '3'], ''))
                byte_codelines.append((
                    lineno, indents, ['set', var_i, '0'], ''))
                labels[this_block[2]] = len(byte_codelines)
                byte_codelines.append((
                    lineno, indents, ['op', 'add', var_i, var_i, '1'], ''))
                byte_codelines.append((
                    lineno, indents,
                    translate_jump(this_block[2], [var_i, '<', var_end]), ''))
            # error
            else:
                fatal(lineno, f"unknown macro '{tokens[0]}'")
        else:
            # process statement
            if tokens[0] == 'jump':
                tokens = ['end'] if len(tokens) == 1 else \
                    translate_jump(tokens[1], tokens[2:])
            elif tokens[0] == 'end':
                if len(tokens) > 1:
                    tokens = translate_jump('0', tokens[1:])
            elif tokens[0] == 'ucontrol' or tokens[0] == 'control':
                tokens.extend(['0'] * (7 - len(tokens)))
            elif tokens[0] == 'draw':
                tokens.extend(['0'] * (8 - len(tokens)))
            elif tokens[0] == 'ulocate':
                if len(tokens) == 7:
                    tokens.append(f'__ulocate{lineno}')
                if len(tokens) == 8:
                    tokens.append('building')
            elif len(tokens) > 1 and tokens[1].endswith('='):
                if tokens[1] != '=':
                    tokens.insert(2, tokens[1].removesuffix('='))
                    tokens.insert(2, tokens[0])
                    tokens[1] = '='
                if len(tokens) == 3:
                    if tokens[2].startswith('%'):
                        tokens = ['getlink', tokens[0], tokens[2][1:]]
                    elif '"' not in tokens[2] and '.' in tokens[2]:
                        tokens = ['sensor', tokens[0], *tokens[2].split('.')]
                    elif '"' not in tokens[2] and '[' in tokens[2]:
                        cell, ind = tokens[2].split('[', 1)
                        tokens = ['read', tokens[0], cell, ind[:-1]]
                    elif '[' in tokens[0]:
                        cell, ind = tokens[0].split('[', 1)
                        tokens = ['write', tokens[2], cell, ind[:-1]]
                    else:
                        tokens[0], tokens[1] = 'set', tokens[0]
                elif len(tokens) == 4:
                    tokens = ['op', tokens[2], tokens[0], tokens[3], '0']

                else:
                    tokens[0], tokens[1], tokens[2], tokens[3] = \
                        'op', convert_op(tokens[3]), tokens[0], tokens[2]
            byte_codelines.append((lineno, indents, tokens, comments))

    if control_stack:
        fatal(control_stack[-1][0], f'unfinished .{control_stack[-1][1]}')

    for label, address in labels.items():
        if address == len(byte_codelines):
            labels[label] = 0

    compiled_codelines = []
    for lineno, indents, tokens, comments in byte_codelines:
        if tokens[0] == 'jump':
            if not tokens[1].isdigit():
                if tokens[1] not in labels:
                    fatal(lineno, f"unknown labels '{tokens[1]}'")
                tokens[1] = str(labels[tokens[1]])
            if tokens[1] == '0' and tokens[2] == 'always':
                tokens = ['end']
        compiled = indents + ' '.join(tokens)
        if comments:
            compiled += '  # ' + comments
        compiled_codelines.append(compiled)

    return compiled_codelines


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description="MinAsm")
    parser.add_argument('file', type=open, help='source file')
    parser.add_argument(
        '-l', '--lineno', action='store_true', help='with line number')
    args = parser.parse_args()
    res = minasm_compile(args.file.readlines())
    if args.lineno:
        for i, line in enumerate(res):
            print(str(i).rjust(3), line, sep=': ')
    else:
        print(*res, sep='\n')
