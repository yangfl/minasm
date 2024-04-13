'use strict'

;(
/**
 * @param {string} name
 * @param {string[]} requires
 * @param {function} factory
 * @param {string} onExist
 */
function (name, requires, factory, onExist = 'warn') {
  let obj = null
  let set = false

  // Browser globals
  if (typeof self === 'object' && self === self.self &&
      requires.every(dep => dep in self)) {
    set = true
    if (!(name in self) || onExist === 'override') {
      self[name] = factory(...requires.map(dep => self[dep]))
    } else if (onExist === 'ignore') {
      // do nothing
    } else {
      const msg =
        'Module ' + name + ' already exists in the global scope.'
      if (onExist === 'error') {
        throw Error(msg)
      } else {
        console.warn(msg)
      }
    }
    obj = self[name]
  }

  // Node. Does not work with strict CommonJS, but
  // only CommonJS-like environments that support module.exports,
  // like Node.
  if (typeof module === 'object' && module.exports) {
    set = true
    if (!obj) {
      obj = factory(...requires.map(dep => require(dep)))
      if (typeof self === 'object' && self === self.self) {
        self[name] = obj
      }
    }
    module.exports = obj
  }

  // AMD.
  if (typeof define === 'function' && define.amd) {
    set = true
    define(name, requires, function (...args) {
      if (!obj) {
        obj = factory(...args)
        if (typeof self === 'object' && self === self.self) {
          self[name] = obj
        }
      }
      return obj
    })
  }

  if (!set) {
    throw Error('Could not set module ' + name)
  }
})('Minasm', [], function () {
  /**
   * Match a string against a regular expression from the given position and
   * return the match.
   * @param {string} str The string to match.
   * @param {RegExp} regex A regular expression object.
   * @param {number} position The position to start the match.
   * @returns {RegExpExecArray?} The match array.
   */
  function matchFrom (str, regex, position = 0) {
    const reg = new RegExp(regex, 'g')
    reg.lastIndex = position
    return reg.exec(str)
  }


  /** @type {Object<string, string[]>} */
  const opcodes = {
    // all instructions
    root: [
      'read', 'write', 'draw',
      'print', 'printchar', 'format',

      'drawflush', 'printflush', 'getlink',
      'control', 'radar', 'sensor',

      'set', 'op', 'lookup', 'packcolor',

      'wait', 'stop', 'end', 'jump',

      'ubind', 'ucontrol', 'uradar', 'ulocate',

      'getblock', 'setblock', 'spawn',
      'status', 'weathersense', 'weatherset',
      'spawnwave', 'setrule', 'message',
      'cutscene', 'effect', 'explosion',
      'setrate', 'fetch', 'sync',
      'getflag', 'setflag', 'setprop',
      'playsound', 'setmarker', 'makemarker',
      'localeprint',
    ],

    // instructions by types
    inputOutput: [
      'read', 'write', 'draw',
      'print', 'printchar', 'format',
    ],
    blockControl: [
      'drawflush', 'printflush', 'getlink',
      'control', 'radar', 'sensor',
    ],
    operations: [
      'set', 'op', 'lookup', 'packcolor',
    ],
    flowControl: [
      'wait', 'stop', 'end', 'jump',
    ],
    unitControl: [
      'ubind', 'ucontrol', 'uradar', 'ulocate',
    ],
    world: [
      'getblock', 'setblock', 'spawn',
      'status', 'weathersense', 'weatherset',
      'spawnwave', 'setrule', 'message',
      'cutscene', 'effect', 'explosion',
      'setrate', 'fetch', 'sync',
      'getflag', 'setflag', 'setprop',
      'playsound', 'setmarker', 'makemarker',
      'localeprint',
    ],

    // instruction opcodes
    draw: [
      'clear', 'color', 'col', 'stroke',
      'line', 'rect', 'lineRect', 'poly', 'linePoly', 'triangle',
      'image',
    ],
    control: [
      'enabled', 'shoot', 'shootp', 'config', 'color',
    ],
    radar: [
      'any', 'enemy', 'ally', 'player', 'attacker', 'flying', 'boss', 'groud',
    ],
    op: [
      'add', 'sub', 'mul', 'div',
      'idiv', 'mod', 'pow', 'equal',
      'notEqual', 'land', 'lessThan', 'lessThanEq',
      'greaterThan', 'greaterThanEq', 'strictEqual', 'shl',
      'shr', 'or', 'and', 'xor',
      'not', 'max', 'min', 'angle',
      'len', 'noise', 'abs', 'log',
      'log10', 'floor', 'ceil', 'sqrt',
      'rand', 'sin', 'cos', 'tan',
      'asin', 'acos', 'atan',
    ],
    lookup: [
      'block', 'unit', 'item', 'liquid',
    ],
    jump: [
      'equal', 'notEqual', 'lessThan', 'lessThanEq',
      'greaterThan', 'greaterThanEq', 'strictEqual', 'always',
    ],
    ucontrol: [
      'idle', 'stop',
      'move', 'approach', 'pathfind', 'autoPathfind', 'boost',
      'target', 'targetp',
      'itemDrop', 'itemTake', 'payDrop', 'payTake', 'payEnter',
      'mine',
      'flag',
      'build', 'getBlock',
      'within',
      'unbind',
    ],
    ulocate: [
      'ore', 'building', 'spawn', 'damaged',
    ],
    building: [
      'core', 'storage', 'generator', 'turret',
      'factory', 'repair', 'battery', 'reactor',
    ],
    getblock: [
      'floor', 'ore', 'block', 'building',
    ],
    setblock: [
      'floor', 'ore', 'block',
    ],
    status: [
      'burning', 'freezing', 'unmoving', 'slow',
      'wet', 'melting', 'sapped', 'electrified',
      'spore-slowed', 'tarred', 'overdrive', 'overclock',
      'shielded', 'boss', 'shocked', 'blasted',
      'corroded', 'disarmed', 'invincible',
    ],
    setrule: [
      'currentWaveTime', 'waveTimer', 'waves', 'wave',
      'waveSpacing', 'attackMode', 'enemyCoreBuildRadius', 'dropZoneRadius',
      'unitCap', 'mapArea', 'lighting', 'ambientLight',
      'solarMultiplier', 'buildSpeed', 'unitBuildSpeed', 'unitDamage',
      'blockHealth', 'blockDamage', 'rtsMinWeight', 'rtsMinSquad',
    ],
    message: [
      'notify', 'announce', 'toast', 'mission',
    ],
    cutscene: [
      'pan', 'zoom', 'stop',
    ],
    effect: [
      'warn', 'cross', 'blockFall', 'placeBlock', 'placeBlockSpark', 'breakBlock', 'spawn', 'trail',
      'breakProp', 'smokeCloud', 'vapor', 'hit', 'hitSquare', 'shootSmall', 'shootBig', 'smokeSmall',
      'smokeBig', 'smokeColor', 'smokeSquare', 'smokeSquareBig', 'spark', 'sparkBig', 'sparkShoot', 'sparkShootBig',
      'drill', 'drillBig', 'lightBlock', 'explosion', 'smokePuff', 'sparkExplosion', 'crossExposion', 'wave',
      'bubble',
    ],
    fetch: [
      'unit', 'unitCount', 'player', 'playerCount',
      'core', 'coreCount', 'build', 'buildCount',
    ],
    setmarker: [
      'remove', 'world', 'minimap',
      'autoscale', 'pos', 'endPos',
      'drawLayer', 'color', 'radius',
      'stroke', 'rotation', 'shapr',
      'arc', 'flushText', 'fontSize',
      'textHeight', 'labelFalgs', 'texture',
      'textureSize', 'posi', 'uvi',
      'colori',
    ],
    makemarker: [
      'shapeText', 'point', 'shape', 'text', 'line', 'texture', 'quad',
    ],
  }


  /** @type {Object<string, number>} */
  const opcodeArgsLength = {
    read: 3,
    write: 3,
    draw: 7,
    print: 1,
    printchar: 1,
    format: 1,

    drawflush: 1,
    printflush: 1,
    getlink: 2,
    control: 6,
    radar: 7,
    sensor: 3,

    set: 2,
    op: 4,
    lookup: 3,
    packcolor: 5,

    wait: 1,
    stop: 0,
    end: 0,
    jump: 4,

    ubind: 1,
    ucontrol: 6,
    uradar: 7,
    ulocate: 8,

    getblock: 4,
    setblock: 6,
    spawn: 6,
    status: 4,
    weathersense: 2,
    weatherset: 2,
    spawnwave: 3,
    setrule: 6,
    message: 3,
    cutscene: 5,
    effect: 5,
    explosion: 9,
    setrate: 1,
    fetch: 5,
    sync: 1,
    getflag: 2,
    setflag: 2,
    setprop: 3,
    playsound: 7,
    setmarker: 5,
    makemarker: 5,
    localeprint: 1,
  }


  /**
   * @typedef CompilerOptions
   * @property {Iterable<string>} [labelPrefixes] all mentioned label prefixes
   * @property {boolean} [noDebug] if true, do not print corresponding source lines as comments
   * @property {boolean} [endAsJump] if true, translate `end` instruction into `jump 0`
   * @property {boolean} [stopAsJump] if true, translate `stop` instruction into `jump self`
   * @property {boolean | string} [jump]
   *  Determinate how to print jump targets.
   *
   *  If `jump` is `true`, targets are printed as relative line offsets (marked as `+` or `-`).
   *
   *  If `jump` is a string, targets are printed as labels, prefixed with that string. Empty string is allowed.
   */

  /**
   * @implements {Iterator<[number, Token], undefined>}
   * @implements {Iterable<[number, Token]>}
   */
  class TokenIterator {
    /**
     * input string
     * @type {string}
     * @private
     */
    str
    /**
     * string pointer, `-1` is EOF
     * @type {number}
     * @private
     */
    i
    /**
     * whether to keep whitespace tokens
     * @type {boolean}
     * @private
     */
    keepWhitespace

    /**
     * @param {string} str Input string.
     * @param {boolean} keepWhitespace Whether to keep whitespace tokens.
     * @param {number} start Starting position.
     */
    constructor (str, keepWhitespace = false, start = 0) {
      this.str = str
      this.i = str ? start : -1
      this.keepWhitespace = keepWhitespace
    }

    [Symbol.iterator] () {
      return this
    }

    next () {
      while (this.i >= 0) {
        if (this.i >= this.str.length) {
          this.i = -1
          break
        }

        const [type, str] = Token.detect(this.str, this.i)
        const start = this.i
        this.i += str.length
        if (this.keepWhitespace || type !== Token.WHITESPACE) {
          return {
            done: false,
            value: [start, new Token(str, type)]
          }
        }
      }
      return {done: true}
    }
  }


  /**
   * A lexer token.
   */
  class Token {
    /** @type {0} */
    static WHITESPACE = 0
    /** @type {1} */
    static IDENTIFIER = 1
    /** @type {2} */
    static BUILTIN = 2
    /** @type {3} */
    static NUMERIC = 3
    /** @type {4} */
    static STRING = 4
    /** @type {5} */
    static OPERATOR = 5
    /** @type {6} */
    static COMMENT = 6

    static NULL = new Token('null', Token.BUILTIN)
    static FALSE = new Token('false', Token.BUILTIN)
    static TRUE = new Token('true', Token.BUILTIN)
    static COUNTER = new Token('@counter', Token.IDENTIFIER)
    static ZERO = new Token('0', Token.NUMERIC)

    /**
     * token type
     * @type {0|1|2|3|4|5|6}
     * @readonly
     */
    type
    /**
     * token content
     * @type {string}
     * @readonly
     */
    str

    /**
     * @param {string} str Token content.
     * @param {number} type Token type.
     */
    constructor (str, type = Token.IDENTIFIER) {
      this.type = type
      this.str = str

      Object.freeze(this)
    }

    /**
     * Tell whether token type has lexical meaning.
     * @param {number} type
     */
    static meaningful (type) {
      return type !== this.WHITESPACE && type !== this.COMMENT
    }

    /**
     * Detect token type and length.
     * @param {string} str Input string.
     * @param {number} start Starting position.
     * @returns {[number, string]} Token type and content.
     */
    static detect (str, start = 0) {
      if (start >= str.length) {
        throw new RangeError(
          `start position ${start} excceed string length ${str.length}`)
      }

      const char = str[start]
      let type
      if (char === '#') {
        type = this.COMMENT
      } else if (char === '"') {
        type = this.STRING
      } else if (/^[+-]?\.?\d/.test(str.slice(start, start + 3))) {
        type = this.NUMERIC
      } else if ('=><!~?:&|+-*/\^%.[]'.includes(char)) {
        type = this.OPERATOR
      } else if (char.trim()) {
        type = this.IDENTIFIER
      } else {
        type = this.WHITESPACE
      }

      let regex
      switch (type) {
        case this.WHITESPACE:
          regex = /\S/
          break
        case this.IDENTIFIER:
          regex = /[\s.\[\]%]/
          break
        case this.NUMERIC:
          regex = /[\s\[\]%]/
          break
        case this.STRING: {
          let end = start + 1
          while (true) {
            const result = matchFrom(str, /["\\\n]/, end)
            if (!result) {
              return [type, str.substring(start)]
            }
            end = result.index
            switch (str[end]) {
              case '\\':
                end += 2
                break
              case '"':
                end++
                // fallthrough
              default:
                return [type, str.substring(start, end)]
            }
          }
        }
        case this.OPERATOR:
          regex = /[^=><!~?:&|+\-*/\\^%.\[\]]/
          break
        case this.COMMENT: {
          const end = str.indexOf('\n', start)
          return [type, str.substring(start, end >= 0 ? end : str.length)]
        }
        default:
          throw new RangeError(`unknown token type ${type}`)
      }

      const token = str.substring(
        start, matchFrom(str, regex, start)?.index || str.length)
      switch (type) {
        case this.IDENTIFIER:
          switch (token) {
            case 'null':
            case 'false':
            case 'true':
              type = this.BUILTIN
              break
          }
      }
      return [type, token]
    }

    /**
     * Split code into tokens.
     * @param {string} str Input string.
     * @param {boolean} keepWhitespace Whether to keep whitespace tokens.
     * @param {number} start Starting position.
     * @returns {Iterable<[number, Token]>} Tokens.
     */
    static split (str, keepWhitespace = false, start = 0) {
      return new TokenIterator(str, keepWhitespace, start)
    }

    /**
     * whether this token is an immediate value
     * @type {boolean}
     */
    get isImm () {
      return this.type === Token.BUILTIN || this.type === Token.NUMERIC ||
        this.type === Token.STRING
    }

    toString () {
      return this.str
    }

    toNumber () {
      return this.type !== Token.NUMERIC ? NaN : Number(this.toString())
    }

    toValue () {
      switch (this.type) {
        case Token.NUMERIC:
          return Number(this.toString())
        case Token.STRING:
          return JSON.parse(this.toString())
        case Token.BUILTIN:
          switch (this.str) {
            case 'null':
              return null
            case 'false':
              return false
            case 'true':
              return true
          }
          // fallthrough
        default:
          return this.toString()
      }
    }

    /**
     * Test if two tokens equal.
     * @param {Token} value Token.
     * @returns {boolean} `true` if equal.
     */
    equal (value) {
      return this.type === value.type && this.str === value.str
    }
  }


  /**
   * A parsed line.
   */
  class Line {
    /**
     * tokens
     * @type {Token[]}
     */
    tokens
    /**
     * indentation
     * @type {string}
     */
    indent
    /**
     * line number
     * @type {number}
     */
    lineNumber

    /**
     * @param {Iterable<Token>} tokens Tokens.
     * @param {string} indent Indentation.
     * @param {number} lineNumber Line number.
     */
    constructor (tokens, indent = '', lineNumber = -1) {
      this.tokens = Array.isArray(tokens) ? tokens : Array.from(tokens)
      this.indent = indent
      this.lineNumber = lineNumber
    }

    /**
     * Parse line.
     * @param {string} str Input string.
     * @param {number} lineNumber Line number.
     * @returns {Line} Parsed line.
     */
    static fromString (str, lineNumber = -1) {
      return new Line(
        Array.from(Token.split(str)).map(x => x[1]),
        str.match(/^\s+/)?.[0] || undefined, lineNumber)
    }

    toString () {
      return this.indent + this.tokens.join(' ')
    }
  }


  /**
   * @implements {Iterator<Instruction, undefined>}
   * @implements {Iterable<Instruction>}
   */
  class InstructionIterator {
    /**
     * instruction stack
     * @type {Instruction[]}
     */
    stack = []
    /**
     * outputted instructions
     * @type {Set<Instruction>}
     */
    result = new Set
    /**
     * initial start instruction
     * @type {Instruction?}
     */
    start

    /**
     * @param {Instruction} start Instruction to start from.
     */
    constructor (start) {
      this.start = start
    }

    get cur () {
      return this.stack[this.stack.length - 1]
    }

    set cur (value) {
      this.stack[this.stack.length - 1] = value
    }

    [Symbol.iterator] () {
      return this
    }

    next () {
      if (this.start) {
        const start = this.start
        this.start = null
        this.stack.push(start)
        return {done: false, value: start}
      }

      this.result.add(this.cur)
      while (this.stack.length !== 0) {
        const branch = this.cur.branch
        if (branch && !this.result.has(branch)) {
          this.stack.push(branch)
          return {done: false, value: branch}
        }

        const next = this.cur.next
        if (next && !this.result.has(next)) {
          this.cur = next
          return {done: false, value: next}
        }

        this.stack.pop()
      }
      return {done: true}
    }
  }


  /**
   * An instruction.
   * @implements {Iterable<Instruction>}
   */
  class Instruction {
    static reverseCondition = new Map(Object.entries({
      'equal': 'notEqual',
      'notEqual': 'equal',
      'strictEqual': 'strictNotEqual',
      'strictNotEqual': 'strictEqual',
      'lessThan': 'greaterThanEq',
      'lessThanEq': 'greaterThan',
      'greaterThan': 'lessThanEq',
      'greaterThanEq': 'lessThan',
      'always': 'never',
      'never': 'always',
    }))

    static reverseConditionToken = new Map(
      Array.from(Instruction.reverseCondition).map(
        ([key, value]) => [key, new Token(value)]))

    static operators = new Map(Object.entries({
      // core/src/mindustry/logic/LogicOp.java
      '+': 'add',
      '-': 'sub',
      '*': 'mul',
      '/': 'div',
      '//': 'idiv',
      '%': 'mod',
      '**': 'pow',

      '==': 'equal',
      '!=': 'notEqual',
      '<': 'lessThan',
      '<=': 'lessThanEq',
      '>': 'greaterThan',
      '>=': 'greaterThanEq',
      '===': 'strictEqual',
      '!==': 'strictNotEqual',

      '&&': 'land',
      '||': 'or',

      '<<': 'shl',
      '>>': 'shr',
      '|': 'or',
      '&': 'and',
      '^': 'xor',
      '~': 'not',
    }))

    static operatorTokens = new Map(
      Array.from(Instruction.operators)
        .map(([key, value]) => [key, new Token(value)]))

    static ALWAYS = Instruction.reverseConditionToken.get('never')
    static NEVER = Instruction.reverseConditionToken.get('always')
    static NOT_EQUAL = Instruction.reverseConditionToken.get('equal')

    static LABEL_START = new Token('_start')

    /**
     * instruction operator
     * @type {string}
     */
    op
    /**
     * instruction arguments
     * @type {Token[]}
     */
    args

    /**
     * next instruction, also the false branch when instruction is a jump
     * @type {Instruction | Token | null}
     */
    next = null
    /**
     * the true branch when instruction is a jump
     * @type {Instruction | Token | null}
     */
    branch = null
    /**
     * keep next target
     * @type {boolean}
     */
    keepNext = false
    /**
     * keep branch target
     * @type {boolean}
     */
    keepBranch = false

    /**
     * jump label, for debugging
     * @type {string?}
     */
    label = null
    /**
     * line number, for code gen
     * @type {number}
     */
    index
    /**
     * sub line number, for code gen
     * @type {number}
     */
    subindex

    /**
     * original code line, for code gen
     * @type {Line?}
     */
    line
    /**
     * codegen options
     * @type {CompilerOptions}
     */
    options = {}

    /**
     * @param {string | Instruction} op Instruction operator.
     * @param {Iterable<Token>} args Instruction arguments.
     * @param {Line} line Original code line, for code gen.
     * @param {number} subindex Sub line number, for code gen.
    */
    constructor (op, args = [], line = null, subindex = 0) {
      if (!(op instanceof Instruction)) {
        this.op = op.toString()
        this.args = Array.isArray(args) ? args : Array.from(args)

        this.index = line ? line.lineNumber : -1
        this.subindex = subindex

        this.line = line
      } else {
        this.op = op.op
        this.args = op.args.slice()
        this.next = op.next
        this.branch = op.branch
        this.label = op.label
        this.index = op.index
        this.subindex = op.subindex
        this.line = op.line
      }
    }

    /**
     * @param {Instruction} a
     * @param {Instruction} b
     * @returns {number}
     */
    static distance (a, b) {
      return 128 * (a.index - b.index) + (a.subindex - b.subindex)
    }

    /**
     * @param {Instruction} other
     * @returns {number}
     */
    distance (other) {
      return Instruction.distance(this, other)
    }

    /**
     * @param {Instruction} a
     * @param {Instruction} b
     * @returns {number}
     */
    static compare (a, b) {
      return a.index - b.index || a.subindex - b.subindex
    }

    /**
     * Decode Minasm condition expression to Mindustry format, where operator is
     * the first token, and operands are the rest.
     * @param {Token[]} args Minasm condition expression.
     * @returns {Token[]?} Mindustry condition expression.
     */
    static _decodeCondition (args) {
      if (args.length === 0) {
        return args
      }
      const op = args[0].toString()
      if (Instruction.reverseCondition.has(op)) {
        return args
      }
      const newTokenOp = Instruction.operatorTokens.get(op)
      if (newTokenOp &&
          Instruction.reverseCondition.has(newTokenOp.toString())) {
        const result = args.slice()
        result[0] = newTokenOp
        return result
      }
      if (args.length === 1) {
        return [Instruction.NOT_EQUAL, args[0], Token.FALSE]
      }
      return null
    }

    /**
     * Decode Minasm condition expression to Mindustry format.
     * @param {Token[]} args Minasm condition expression.
     * @returns {Token[]} Mindustry condition expression.
     */
    static decodeCondition (args) {
      if (args.length === 0) {
        return args
      }
      const res = Instruction._decodeCondition(args)
      if (res) {
        return res
      }

      if (args.length === 1) {
        return args
      }
      const result = args.slice()
      const tmp = result[0]
      result[0] = result[1]
      result[1] = tmp
      return Instruction._decodeCondition(result) || args
    }

    /**
     * Decode Minasm assignment statement to Mindustry instruction.
     * @param {Token[]} tokens Minasm assignment statement.
     * @returns {[string, Token[]]?}
     *  Mindustry instruction operator and arguments.
     */
    static decodeAssignment (tokens) {
      if (tokens.length <= 1 || tokens[0].type !== Token.IDENTIFIER) {
        return null
      }
      let args = [tokens[0]]

      const assign = tokens[1].toString()
      if (assign === '[') {
        // cell [ i ] = x
        //   0  1 2 3 4 5
        if (tokens.length === 2) {
          return ['write', args]
        }
        args.push(tokens[2])
        if (tokens.length >= 4 && tokens[3].toString() !== ']') {
          return null
        }
        if (tokens.length >= 5 && tokens[4].toString() !== '=') {
          return null
        }
        if (tokens[5]) {
          args.unshift(tokens[5])
        }
        return ['write', args.concat(tokens.slice(6))]
      }

      if (!assign.endsWith('=')) {
        return null
      }

      let op
      if (assign === '=') {
        if (tokens.length === 2) {
          // x =
          // 0 1
          return ['set', args]
        }
        const token2Str = tokens[2].toString()
        if (token2Str === '%') {
          // x = % y
          // 0 1 2 3
          return ['getlink', args.concat(tokens.slice(3))]
        }
        if (tokens.length === 3) {
          // x = y
          // 0 1 2
          return ['set', [tokens[0], tokens[2]]]
        }
        if (opcodes.op.includes(token2Str)) {
          // x = op y
          // 0 1 2  3
          args = [tokens[2], tokens[0]].concat(tokens.slice(3))
          while (args.length < 4) {
            args.push(Token.ZERO)
          }
          return ['op', args]
        }
        if (Instruction.operatorTokens.has(token2Str)) {
          // x = . y
          // 0 1 2 3
          args = [
            Instruction.operatorTokens.get(token2Str), tokens[0]
          ].concat(tokens.slice(3))
          while (args.length < 4) {
            args.push(Token.ZERO)
          }
          return ['op', args]
        }
        // x = y . z
        // 0 1 2 3 4
        op = tokens[3].toString()
        args.push(tokens[2])
        args = args.concat(tokens.slice(4))
      } else {
        // x .= y
        // 0 1  2
        op = assign.slice(0, -1)
        args.push(tokens[0])
        args = args.concat(tokens.slice(2))
      }

      if (op === '.') {
        return ['sensor', args]
      } else if (op === '[') {
        args.splice(3, 1)
        return ['read', args]
      }
      args.unshift(Instruction.operatorTokens.get(op) || new Token(op, 0))
      return ['op', args]
    }

    /**
     * Decode Minasm statement to Mindustry instruction.
     * @param {Token[]} tokens Minasm statement.
     * @returns {[string, Token[], Token?]}
     *  Mindustry instruction operator, arguments, and label of branch target if
     *  instruction is a jump.
     */
    static decode (tokens) {
      if (tokens.length === 0 || tokens[0].type !== Token.IDENTIFIER) {
        return null
      }

      const args = tokens.slice(1)
      while (args.length !== 0 &&
             args[args.length - 1].type === Token.COMMENT) {
        args.pop()
      }

      const op = tokens[0].toString()
      switch (op) {
        case 'end':
        case 'stop':
          return [op, Instruction.decodeCondition(args)]
        case 'jump': {
          const branch = args.shift()
          return [op, Instruction.decodeCondition(args), branch]
        }
      }

      if (!opcodes.root.includes(op)) {
        args.unshift(tokens[0])
        return Instruction.decodeAssignment(args) ||
          [tokens[0].toString(), args.slice(1)]
      }

      while (args.length < opcodeArgsLength[op]) {
        args.push(Token.ZERO)
      }
      return [op, args]
    }

    /**
     * @returns {Iterator<Instruction, undefined>}
     */
    [Symbol.iterator] () {
      return new InstructionIterator(this)
    }

    /**
     * whether instruction is a jump
     * @type {boolean}
     */
    get isJump () {
      return this.op === 'jump'
    }

    /**
     * get jump direction, <0 is branch, 0 is conditional, >0 is next
     * @type {number}
     */
    get jumpDirection () {
      if (this.args.length === 0) {
        return -1
      }
      if (this.args[0].type !== Token.IDENTIFIER) {
        return 0
      }

      const op = this.args[0].toString()
      switch (op) {
        case 'always':
          return -1
        case 'never':
          return 1
      }

      if (this.args.length < 3) {
        return 0
      }
      const isStrictEqual =
        this.args[1].type === this.args[2].type &&
        this.args[1].toValue() === this.args[2].toValue()
      const isEqual =
        isStrictEqual || this.args[1].toValue() == this.args[2].toValue()
      const isImm = this.args[1].isImm && this.args[2].isImm
      let ret = 0
      switch (op) {
        case 'equal':
          if (isImm) {
            ret = isEqual ? -1 : 1
          } else if (isStrictEqual) {
            ret = -1
          }
          break
        case 'strictEqual':
          if (isImm) {
            ret = isStrictEqual ? -1 : 1
          } else if (isStrictEqual) {
            ret = -1
          }
          break
        case 'notEqual':
          if (isImm) {
            ret = isEqual ? 1 : -1
          } else if (isStrictEqual) {
            ret = 1
          }
          break
        case 'strictNotEqual':
          if (isImm) {
            ret = isStrictEqual ? 1 : -1
          } else if (isStrictEqual) {
            ret = 1
          }
          break
      }
      if (ret < 0) {
        this.args.length = 0
      } else if (ret > 0) {
        this.args.length = 1
        this.args[0] = Instruction.NEVER
      }
      return ret
    }

    /**
     * whether instruction is generated from a Minasm macro
     * @type {boolean}
     */
    get isMacro () {
      return this.line && this.line.tokens.length > 0 &&
        this.line.tokens[0].toString() === '.'
    }

    /**
     * Get a descriptive label for this instruction.
     * @returns {string} Label.
     */
    getLabel () {
      return this.label ? this.label :
             typeof this.index === 'number' ? this.index.toString() :
             '<inst>'
    }

    /**
     * Get the branch target of this instruction, if this instruction is an
     * unconditional jump.
     * @param {boolean} jumpCallee Whether callee instruction is a jump.
     * @param {Set<Instruction>} trace Loop detector.
     * @returns {Instruction?} Target instruction, or null if not an
     *  unconditional jump.
     */
    getTarget (jumpCallee = false, trace = new Set) {
      if (trace.has(this)) {
        // loop detected
        return this
      }
      if (!this.isJump) {
        // not a jump
        return null
      }
      const jumpDirection = this.jumpDirection
      if (jumpDirection == 0) {
        // not an unconditional jump
        return null
      }

      trace.add(this)
      if (jumpDirection > 0) {
        if (this.keepBranch) {
          return this
        }
        const target = this.next?.getTarget(true, trace)
        if (target) {
          this.next = target
        }
        return this.next
      } else {
        if (this.keepNext) {
          return this
        }
        const target = this.branch?.getTarget(true, trace)
        if (target) {
          this.branch = target
        }
        return this.branch
      }
    }

    toString (withToken = false) {
      let str = ''
      if (0) {  // debugger
        str = this.index.toString().padStart(2) + ' [' +
          (this.next ? this.next.index.toString().padStart(2) : '  ') + ']: '
      }

      if (this.options.labelPrefixes) {
        const label = this.label || 'L' + this.index.toString()
        for (const prefix of this.options.labelPrefixes) {
          str += prefix + label + ':\n'
        }
      }

      if (this.line && this.line.indent) {
        str += this.line.indent
      }
      str += this.op
      if (this.isJump) {
        str += ' '
        if (!this.branch) {
          str += '<null>'
        } else if (typeof this.options.jump === 'string') {
          str += this.options.jump
          str += this.branch.label || 'L' + this.branch.index.toString()
        } else if (!this.options.jump) {
          str += this.branch.index
        } else {
          const diff = this.branch.index - this.index
          if (diff >= 0) {
            str += '+'
          }
          str += diff
        }
      }
      if (this.args && this.args.length !== 0) {
        str += ' ' + this.args.join(' ')
      }

      if (!this.options.noDebug && this.line &&
          (withToken || this.isMacro)) {
        if (this.isMacro) {
          str += '  # .' + this.line.tokens.slice(1).join(' ')
        } else {
          str += '  # ' + this.line.tokens.join(' ')
        }
      }
      return str
    }

    /**
     * Flip jump condition.
     */
    reverseJump () {
      if (this.args.length === 0) {
        this.args.push(Instruction.NEVER)
      } else {
        const reversedConditionToken = Instruction.reverseConditionToken.get(
          this.args[0].toString())
        if (reversedConditionToken === Instruction.ALWAYS) {
          this.args.length = 0
        } else if (reversedConditionToken) {
          this.args[0] = reversedConditionToken
        }
      }

      const tmp = this.next
      this.next = this.branch
      this.branch = tmp

      const tmpk = this.keepNext
      this.keepNext = this.keepBranch
      this.keepBranch = tmpk
    }

    /**
     * Find the final targets of branches, and try to make sure the line number
     * of next instruction is greater than the one of itself.
     * @returns {boolean} Whether the branch targets were changed.
     */
    normalize () {
      const oldNext = this.next
      const oldBranch = this.branch

      const jumpDirection = this.isJump ? this.jumpDirection : 0

      do {
        if (!this.next?.getTarget) {
          break
        }
        if (this.isJump && jumpDirection < 0 && !this.keepNext) {
          this.next = null
          break
        }

        const next = this.next.getTarget(this.isJump)
        if (!next) {
          break
        }
        if (this.isJump && next === this.branch) {
          this.args.length = 0
          if (!this.keepNext) {
            this.next = null
          }
          break
        }
        this.next = next
      } while (false)

      do {
        if (!this.branch?.getTarget) {
          break
        }
        if (this.isJump && jumpDirection > 0 && !this.keepBranch) {
          this.branch = null
          break
        }

        const branch = this.branch.getTarget(this.isJump)
        if (!branch) {
          break
        }
        if (this.isJump && branch === this.next) {
          this.args[0] = Instruction.NEVER
          this.args.length = 1
          if (!this.keepBranch) {
            this.branch = null
          }
          break
        }
        this.branch = branch
      } while (false)

      if (this.isJump && this.next?.getTarget) {
        if (!this.branch?.getTarget) {
          this.reverseJump()
          return true
        } else {
          const b = this.branch.distance(this)
          const n = this.next.distance(this)
          // -2 -1 0 +1 +2
          // branch next   action
          // -2     -1     y
          // -1      0     y
          // -1     +1     n
          //  0     +1     n
          // +1     +2     y
          // ---------------
          // +2     +1     n
          // +1      0     y
          // +1     -1     y
          //  0     -1     n
          // -1     -2     n
          if (b === n) {
            // do nothing
          } else if (b === 0 || n === 0) {
            if (n === 0) {
              this.reverseJump()
              return true
            }
          } else if (b * n > 0 ? b < n : b > n) {
            this.reverseJump()
            return true
          }
        }
      }

      return oldNext !== this.next || oldBranch !== this.branch
    }
  }


  /**
   * Compiler error.
   */
  class CompilerError extends Error {
    /**
     * error name
     * @type {string}
     * @readonly
     */
    name
    /**
     * line number where error was found
     * @type {number}
     * @readonly
     */
    found
    /**
     * line number where error comes from
     * @type {number}
     * @readonly
     */
    source

    /**
     * @param {string} message Error message.
     * @param {number} found Line number where error was found.
     * @param {number} source Line number where error comes from.
     */
    constructor (message, found = -1, source = -1) {
      super(message)
      this.name = this.constructor.name
      this.found = found
      this.source = source
    }

    toString () {
      let str = super.toString()
      if (this.source >= 0) {
        str += ' (from line ' + this.source + ')'
      }
      str += ' at line ' + this.found
      return str
    }
  }


  class ProgramBlock {
    /**
     * block name
     * @type {string}
     */
    name
    /**
     * begin instruction
     * @type {Instruction}
     */
    begin
    /**
     * end instructions
     * @type {Instruction[]}
     */
    ends
    /**
     * block data
     * @type {any}
     */
    data

    /**
     * @param {string} name
     * @param {Instruction} begin
     * @param {Instruction[]} ends
     * @param {any} [data]
     */
    constructor (name, begin, ends = [], data) {
      this.name = name
      this.begin = begin
      this.ends = ends
      this.data = data
    }
  }


  /**
   * Complete source code.
   * @implements {Iterable<Instruction>}
   */
  class Program {
    /**
     * program head
     * @type {Instruction}
     */
    head = new Instruction('jump', [Instruction.NEVER])
    /**
     * program tail
     * @type {Instruction?}
     */
    tail

    /**
     * all instructions
     * @type {Instruction[]}
     */
    insts = []

    /**
     * labeled instructions
     * @type {Map<string, Instruction>}
     */
    labels = new Map
    /**
     * instructions that within this relative line number range
     * @type {(?Instruction)[]}
     */
    relinsts = []

    /**
     * label name of next instruction
     * @type {Set<string>}
     */
    label = new Set
    /**
     * disable dead code elimination
     * @type {boolean}
     */
    noOptimize = false

    /**
     * source block stack
     * @type {ProgramBlock[]}
     */
    stack = []
    /**
     * jump instruction of block
     * @type {Instruction[]}
     */
    blockEnds = []

    /**
     * codegen options
     * @type {CompilerOptions}
     */
    options = {
      jump: '',
    }

    constructor () {
      this.tail = this.head
      this.labels.set(Instruction.LABEL_START.toString(), this.head)
    }

    [Symbol.iterator] () {
      return this.head[Symbol.iterator]()
    }

    /**
     * @param {string} name
     * @param {Instruction} begin
     * @param {Instruction[]} ends
     * @param {any} [data]
     * @returns {ProgramBlock}
     */
    addBlock (name, begin, ends = [], data) {
      const block = new ProgramBlock(name, begin, ends, data)
      this.stack.push(block)
      return block
    }

    /**
     * @param {ProgramBlock?} block
     * @param {string | string[]} blockStart
     * @returns {boolean}
     */
    static matchBlock (block, blockStart) {
      return block && (typeof blockStart === 'string' ?
        block.name === blockStart : blockStart.includes(block.name))
    }

    /**
     * @param {ProgramBlock?} block
     * @param {string | string[]} blockStart
     * @param {string} blockEnd
     * @param {number} lineNumber
     * @returns {ProgramBlock}
     * @throws {CompilerError}
     */
    static testBlock (block, blockStart, blockEnd, lineNumber = -1) {
      if (!Program.matchBlock(block, blockStart)) {
        throw new CompilerError(
          'unmatched ' + blockEnd, lineNumber,
          !block ? undefined :
          block.begin ? block.begin.index :
          block.ends.length !== 0 ? block.ends.at(-1).index : undefined)
      }
      return block
    }

    /**
     * @param {string | string[]} blockStart
     * @param {string} blockEnd
     * @param {number} lineNumber
     * @returns {ProgramBlock}
     */
    testBlock (blockStart, blockEnd, lineNumber = -1) {
      return Program.testBlock(
        this.stack[this.stack.length - 1], blockStart, blockEnd, lineNumber)
    }

    /**
     * @param {string | string[]} blockStart
     * @returns {?ProgramBlock}
     */
    tryFindBlock (blockStart) {
      for (let i = this.stack.length - 1; i >= 0; i--) {
        if (Program.matchBlock(this.stack[i], blockStart)) {
          return this.stack[i]
        }
      }
      return null
    }

    /**
     * @param {string | string[]} blockStart
     * @param {string} blockEnd
     * @param {number} lineNumber
     * @returns {ProgramBlock}
     */
    findBlock (blockStart, blockEnd, lineNumber = -1) {
      return this.tryFindBlock(blockStart) ||
        Program.testBlock(null, blockStart, blockEnd, lineNumber)
    }

    endBlock () {
      this.blockEnds.push(...this.stack.pop().ends)
    }

    /**
     * @param {Instruction} inst
     * @param {boolean} endLike
     */
    push (inst, endLike = false) {
      for (const option in this.options) {
        inst.options[option] = this.options[option]
      }

      inst.keepNext = this.noOptimize

      // end block
      while (this.blockEnds.length !== 0) {
        this.blockEnds.pop().branch = inst
      }

      // link against tail
      if (this.tail) {
        this.tail.next = inst
      }
      this.tail = endLike && !this.noOptimize ? null : inst

      // mark instruction by label
      if (this.label.size > 0) {
        for (const label of this.label) {
          inst.label = label
          this.labels.set(label, inst)
        }
        this.label.clear()
      }

      // mark relative line number
      if (!inst.isMacro) {
        this.relinsts.push(inst)
      }

      this.insts.push(inst)
    }

    /**
     * @param {number} lineNumber
     * @param {number} newRelindex
     */
    resetRelinsts (lineNumber = -1, newRelindex = 0) {
      while (this.relinsts.length > 0 &&
             !this.relinsts[this.relinsts.length - 1]) {
        this.relinsts.length--
      }

      for (let i = 0; i < this.relinsts.length; i++) {
        const inst = this.relinsts[i]
        if (!inst || !inst.isJump) {
          continue
        }
        const target = inst.branch
        if (!(target instanceof Token) || target.type !== Token.NUMERIC) {
          continue
        }

        let label = target.toNumber()
        const labelStr = target.toString()
        if (!Number.isInteger(label)) {
          throw new CompilerError(
            'jump line number "' + labelStr + '" not an integer', inst.index)
        }
        if (labelStr[0] === '+' || labelStr[0] === '-') {
          label += i
        }

        if (label >= this.relinsts.length) {
          throw new CompilerError(
            'relative jump out of range, want ' + label + ', but max is ' +
            (this.relinsts.length - 1), lineNumber, inst.index)
        }
        do {
          inst.branch = this.relinsts[label]
          label++
        } while (!inst.branch)
      }

      this.relinsts.length = 0
      this.relinsts.length = newRelindex
    }

    resolveLabels () {
      for (const inst of this) {
        const target = inst.branch
        if (!(target instanceof Token) || target.type !== Token.IDENTIFIER) {
          continue
        }
        const label = target.toString()
        inst.branch = this.labels.get(label)
        if (!inst.branch) {
          throw new CompilerError(
            'unknown label `' + label + "'", inst.index)
        }
      }
    }

    /**
     * @param {number} lineNumber
     */
    finish (lineNumber = -1) {
      if (this.stack.length !== 0) {
        const block = this.stack[this.stack.length - 1]
        throw new CompilerError(
          'unmatched ' + block.name, lineNumber, block.begin.index)
      }

      this.resetRelinsts(lineNumber)

      // mark instruction by label
      if (this.label.size > 0) {
        for (const label of this.label) {
          this.head.label = label
          this.labels.set(label, this.head)
        }
        this.label.clear()
      }
      this.resolveLabels()

      while (this.blockEnds.length !== 0) {
        this.blockEnds.pop().branch = this.head
      }
      if (this.tail) {
        this.tail.next = this.head
      }
    }

    deadcodeEliminate (fire = true) {
      let changed = fire
      while (changed) {
        changed = false
        for (const inst of this) {
          changed ||= inst.normalize()
        }
      }
    }

    /**
     * @param {string} code Input string.
     */
    static compile (code) {
      /**
       * prefix of interrupt counter saving variable
       */
      let interruptPrefix = '__interrupt_'
      /**
       * name of stack cell
       * @type {Token?}
       */
      let stackCell = null
      /**
       * name of stack pointer
       * @type {Token}
       */
      let stackPointer = new Token('__stack_pointer')

      const program = new Program

      function setLabel (label, i) {
        const block = program.tryFindBlock('for')
        if (block) {
          throw new CompilerError("label in `for' block", i, block.begin.index)
        }
        if (program.labels.has(label) && !label.startsWith('_')) {
          throw new CompilerError(
            'duplicate label `' + label + "'", i,
            program.labels.get(label).index - 1)
        }
        program.label.add(label)
      }

      const lines = code.split('\n')
      /** @type {Instruction[]} */
      for (let i = 0; i < lines.length; i++) {
        const line = Line.fromString(lines[i], i)
        const tokens = line.tokens.slice()
        // remove any comments
        while (tokens.length > 0 &&
               tokens[tokens.length - 1].type === Token.COMMENT) {
          tokens.pop()
        }
        if (tokens.length === 0) {
          // do not increase line number, as of Mindustry's behavior
          continue
        }

        const token0 = tokens[0]
        if (token0.type === Token.NUMERIC) {
          throw new CompilerError('numeric value at line beginning', i)
        }

        const command = token0.toString()
        if (command !== '.') {
          if (command.endsWith(':')) {
            // process label
            if (tokens.length > 1) {
              throw new CompilerError('extra tokens after label declaration', i)
            }
            if (command.length > 1) {
              setLabel(command.slice(0, -1), i)
            }
          } else {
            // process normal instructions
            const [op, args, branch] = Instruction.decode(tokens)
            const inst = new Instruction(op, args, line)
            if (branch) {
              inst.branch = branch
            } else if (op === 'end') {
              inst.op = 'jump'
              inst.branch = Instruction.LABEL_START
            } else if (op === 'stop') {
              inst.op = 'jump'
              inst.branch = inst
            }
            program.push(inst)
          }
          continue
        }

        // process macros
        if (tokens[1]?.type !== Token.IDENTIFIER) {
          continue
        }
        const token2 = tokens[2]

        const macro = tokens[1].toString()
        switch (macro) {
          case 'syntax':
            for (let i = 2; i < tokens.length; i++) {
              const option = tokens[i].toString()
              const ind = option.indexOf('=')
              if (ind >= 0) {
                program.options[option.slice(0, ind)] = option.slice(ind + 1)
              } else if (option.startsWith('no-')) {
                delete program.options[option.slice(3)]
              } else {
                program.options[option] = true
              }
            }
            break
          case 'fun':
            if (stackCell === null) {
              throw new CompilerError('stack cell undefined', i)
            }
            // fallthrough
          case 'label': {
            if (token2) {
              setLabel(token2.toString(), i)
            }
            if (macro === 'fun') {
              program.push(new Instruction(
                'op', [
                  new Token('sub'), stackPointer, stackPointer,
                  new Token('1', Token.NUMERIC)], line))
            }
            break
          }
          case 'rel':
            program.resetRelinsts(i - 1, token2?.toNumber() || 0)
            break
          case 'entry':
            program.tail.keepNext = true
            break
          // stack push pop
          case 'stack':
            if (token2?.type === Token.IDENTIFIER) {
              stackCell = new Token(token2.toString())
              const stackSize = tokens[3]?.toNumber() || 64
              program.push(new Instruction(
                'set', [
                  stackPointer,
                  new Token((stackSize - 1).toString(), Token.NUMERIC)], line))
            }
            break
          case 'push': {
            if (stackCell === null) {
              throw new CompilerError('stack cell undefined', i)
            }
            if (token2) {
              program.push(new Instruction(
                'write', [
                  new Token(token2.toString()), stackCell, stackPointer], line))
            }
            program.push(new Instruction(
              'op', [
                new Token('sub'), stackPointer, stackPointer,
                new Token('1', Token.NUMERIC)], line, 1))
            break
          }
          case 'pushn': {
            if (stackCell === null) {
              throw new CompilerError('stack cell undefined', i)
            }
            program.push(new Instruction(
              'op', [
                new Token('sub'), stackPointer, stackPointer,
                token2 || new Token('1', Token.NUMERIC)], line))
            break
          }
          case 'pop': {
            if (stackCell === null) {
              throw new CompilerError('stack cell undefined', i)
            }
            program.push(new Instruction(
              'op', [
                new Token('add'), stackPointer, stackPointer,
                new Token('1', Token.NUMERIC)], line))
            if (token2) {
              program.push(new Instruction(
                'read', [
                  new Token(token2.toString()), stackCell, stackPointer],
                line, 1))
            }
            break
          }
          case 'popn': {
            if (stackCell === null) {
              throw new CompilerError('stack cell undefined', i)
            }
            program.push(new Instruction(
              'op', [
                new Token('add'), stackPointer, stackPointer,
                token2 || new Token('1', Token.NUMERIC)], line))
            break
          }
          // call ret
          case 'call': {
            if (stackCell === null) {
              throw new CompilerError('stack cell undefined', i)
            }
            if (![Token.IDENTIFIER, Token.STRING].includes(token2?.type)) {
              throw new CompilerError('no function name', i)
            }

            const instSave = new Instruction(
              'write', [stackCell, stackPointer], line)
            program.push(instSave)

            const inst = new Instruction('jump', [], line, 1)
            inst.branch = token2
            program.push(inst, true)

            program.blockEnds.push(instSave)
            break
          }
          case 'retl':
          case 'ret': {
            if (stackCell === null) {
              throw new CompilerError('stack cell undefined', i)
            }

            if (macro === 'ret') {
              program.push(new Instruction(
                'op', [
                  new Token('add'), stackPointer, stackPointer,
                  new Token('1', Token.NUMERIC)], line))
            }
            program.push(new Instruction(
              'read', [Token.COUNTER, stackCell, stackPointer], line, 1), true)
            break
          }
          // int reti
          case 'int': {
            if (![Token.IDENTIFIER, Token.STRING].includes(token2?.type)) {
              throw new CompilerError('no interrupt handler', i)
            }

            const instSave = new Instruction(
              'set', [new Token(
                interruptPrefix + (tokens[3]?.toString() || token2.toString())
              )], line)
            program.push(instSave)

            const inst = new Instruction('jump', [], line, 1)
            inst.branch = token2
            program.push(inst, true)

            program.blockEnds.push(instSave)
            break
          }
          case 'reti': {
            if (![Token.IDENTIFIER, Token.STRING].includes(token2?.type)) {
              throw new CompilerError('no interrupt handler', i)
            }
            const handler = token2.toString()

            program.push(
              new Instruction('set', [
                Token.COUNTER, new Token(interruptPrefix + handler)], line),
              true)
            break
          }
          /*******
           * # .if
           * jump elif ~
           * ...
           * jump fi
           * # .elif
           * jump else ~
           * ...
           * jump fi
           * # .else
           * ...
           * # .fi
           *******/
          case 'if': {
            const inst = new Instruction(
              'jump', Instruction.decodeCondition(tokens.slice(2)), line)
            inst.reverseJump()
            program.push(inst)

            program.addBlock('if', inst, [inst], inst)
            break
          }
          case 'elif': {
            const block = program.testBlock('if', 'elif', i)

            const instEnd = new Instruction('jump', [], line)
            program.push(instEnd)

            const inst = new Instruction(
              'jump', Instruction.decodeCondition(tokens.slice(2)), line)
            inst.reverseJump()
            program.push(inst)

            block.data.branch = inst
            block.data = inst
            block.ends[block.ends.length - 1] = instEnd
            block.ends.push(inst)
            break
          }
          case 'else': {
            const block = program.testBlock('if', 'else', i)
            if (!block.data) {
              throw new CompilerError(
                'excessive else', i, block.ends.at(-1).index)
            }

            const instEnd = new Instruction('jump', [], line)
            program.push(instEnd)

            const inst = new Instruction('jump', [Instruction.NEVER], line)
            program.push(inst)

            block.data.branch = inst
            block.data = null
            block.ends[block.ends.length - 1] = instEnd
            break
          }
          case 'fi': {
            const block = program.testBlock('if', 'fi', i)

            program.endBlock()
            break
          }
          /*******
           * # .break
           * jump end
           * ...
           * # .continue
           * jump begin
           * ...
           *******/
          case 'break': {
            const block = program.findBlock(['while', 'do', 'for'], 'break', i)

            const inst = new Instruction(
              'jump', Instruction.decodeCondition(tokens.slice(2)), line)
            program.push(inst)

            block.ends.push(inst)
            break
          }
          case 'continue': {
            const block = program.findBlock(
              ['while', 'do', 'for'], 'continue', i)

            const inst = new Instruction(
              'jump', Instruction.decodeCondition(tokens.slice(2)), line)
            inst.branch = block.begin
            program.push(inst)

            break
          }
          /*******
           * # .while
           * jump done ~
           * ...
           * jump while
           * # .done
           *******/
          case 'while': {
            const inst = new Instruction(
              'jump', Instruction.decodeCondition(tokens.slice(2)), line)
            inst.reverseJump()
            program.push(inst)

            program.addBlock('while', inst, [inst])
            break
          }
          case 'done': {
            const block = program.testBlock('while', 'done', i)

            const inst = new Instruction('jump', block.begin.args.slice(), line)
            inst.reverseJump()
            program.push(inst)
            inst.branch = block.begin.next

            program.endBlock()
            break
          }
          /*******
           * # .do
           * jump 0 never
           * ...
           * jump do -
           * # .when
           *******/
          case 'do': {
            const inst = new Instruction('jump', [Instruction.NEVER], line)
            program.push(inst)

            program.addBlock('do', inst)
            break
          }
          case 'when': {
            const block = program.testBlock('do', 'when', i)

            const inst = new Instruction(
              'jump', Instruction.decodeCondition(tokens.slice(2)), line)
            inst.branch = block.begin
            program.push(inst)

            program.endBlock()
            break
          }
          case 'until': {
            const block = program.testBlock('do', 'until', i)

            const inst = new Instruction(
              'jump', Instruction.decodeCondition(tokens.slice(2)), line)
            inst.reverseJump()
            inst.branch = block.begin
            program.push(inst)

            program.endBlock()
            break
          }
          /*******
           * # .for var start end step
           * ...
           * # .endfor
           *******/
          case 'for': {
            if (tokens.length < 5 || token2.type !== Token.IDENTIFIER ||
                tokens[3].type !== Token.NUMERIC ||
                tokens[4].type !== Token.NUMERIC ||
                (tokens.length > 5 && tokens[5].type !== Token.NUMERIC)) {
              throw new CompilerError('invalid `for` syntax', i)
            }

            const varName = token2.toString()
            const start = tokens[3].toNumber()
            const end = tokens[4].toNumber()
            const step = tokens[5] ? tokens[5].toNumber() : start < end ? 1 : -1

            const inst = new Instruction('jump', [Instruction.NEVER], line)
            program.push(inst)

            program.addBlock('for', inst, [], [varName, start, end, step])
            break
          }
          case 'endfor': {
            const inst = new Instruction('jump', [Instruction.NEVER], line)
            program.push(inst)

            const block = program.testBlock('for', 'endfor', i)
            program.endBlock()

            const startRel = program.insts.indexOf(block.begin) + 1
            const endRel = program.insts.length
            if (endRel <= startRel) {
              break
            }

            const varName = block.data[0]
            const start = block.data[1]
            const end = block.data[2]
            const step = block.data[3]

            const tokenStart = new Token(start, Token.NUMERIC)
            for (let i = startRel; i < endRel; i++) {
              const inst = program.insts[i]
              for (let j = 0; j < inst.args.length; j++) {
                if (inst.args[j].type === Token.IDENTIFIER &&
                    inst.args[j].toString() === varName) {
                  inst.args[j] = tokenStart
                }
              }
            }

            const body = program.insts.slice(startRel, endRel)
            const branchRel = body.map(inst => body.indexOf(inst.branch))
            const nextRel = body.map(inst => body.indexOf(inst.next))

            const index = program.insts[endRel - 1].index
            let subindex = program.insts[endRel - 1].subindex + 1
            for (let n = start + step;
                 Math.abs(n - start) < Math.abs(end - start); n += step) {
              const tokenN = new Token(n, Token.NUMERIC)
              const bodyN = []
              for (let i = startRel; i < endRel; i++) {
                const inst = new Instruction(program.insts[i])
                bodyN.push(inst)

                inst.index = index
                inst.subindex = subindex
                program.push(inst)

                subindex++

                for (let j = 0; j < inst.args.length; j++) {
                  if (inst.args[j] === tokenStart) {
                    inst.args[j] = tokenN
                  }
                }
              }
              for (let i = 0; i < bodyN.length; i++) {
                if (branchRel[i] >= 0) {
                  bodyN[i].branch = bodyN[branchRel[i]]
                }
                if (nextRel[i] >= 0) {
                  bodyN[i].next = bodyN[nextRel[i]]
                }
              }
            }

            break
          }
          /*******
           * # .case var
           * @counter += var
           * ...
           * # .stop
           * jump end
           * ...
           * # .esac
           *******/
          case 'case': {
            const inst = token2 ?
              new Instruction(
                'op', [new Token('add'), Token.COUNTER,
                       Token.COUNTER, token2], line) :
              new Instruction('jump', [Instruction.NEVER], line)
            program.push(inst)
            program.addBlock('case', inst)
            program.noOptimize = true

            break
          }
          case 'stop': {
            const block = program.findBlock('case', 'stop', i)

            const inst = new Instruction(
              'jump', Instruction.decodeCondition(tokens.slice(2)), line)
            program.push(inst)

            block.ends.push(inst)
            break
          }
          case 'esac': {
            const block = program.testBlock('case', 'esac', i)
            program.noOptimize = false

            program.endBlock()
            break
          }
          default:
            throw new CompilerError('unknown macro `' + macro + "'", i)
        }
      }

      program.finish(lines.length - 1)
      program.deadcodeEliminate()

      // codegen
      const rawInsts = Array.from(program).sort(Instruction.compare)
      if (rawInsts.length === 1) {
        return []
      }
      if (rawInsts[0].branch === rawInsts[1]) {
        rawInsts.shift()
      }

      // fix out of order
      /** @type {Instruction[]} */
      const insts = []
      for (let i = 0; i < rawInsts.length; i++) {
        const inst = rawInsts[i]
        inst.index = insts.length
        insts.push(inst)

        if (inst.next && inst.next !== (
            i + 1 < rawInsts.length ? rawInsts[i + 1] : rawInsts[0])) {
          const newInst = new Instruction('jump', [], inst.line)
          newInst.options = structuredClone(inst.options)
          newInst.options.noDebug = true

          newInst.branch = inst.next
          inst.next = newInst

          newInst.index = insts.length
          insts.push(newInst)
        }
      }

      // fix jumps
      for (let i = 0; i < insts.length; i++) {
        const inst = insts[i]

        for (let j = 0; j < inst.args.length; j++) {
          if (inst.args[j].type === Token.IDENTIFIER &&
              inst.args[j].str.startsWith('@line')) {
            inst.args[j] = new Token(
              (i + Number(inst.args[j].str.slice(5))).toString(), Token.NUMERIC)
          }
        }

        if (inst.isJump) {
          if (typeof inst.options.jump === 'string') {
            (inst.branch.options.labelPrefixes ??= new Set).add(
              inst.options.jump)
          }

          const printJumpLabel = typeof inst.options.jump !== 'string' &&
            !inst.options.jump

          if (inst.args.length === 0) {
            if (inst.branch === insts[0] && (
                !inst.options.endAsJump || printJumpLabel)) {
              inst.op = 'end'
            } else if (inst.branch === inst && (
                !inst.options.stopAsJump || printJumpLabel)) {
              inst.op = 'stop'
              inst.args.length = 0
            } else {
              inst.args.push(Instruction.ALWAYS, Token.ZERO, Token.ZERO)
            }
            continue
          }

          const op = inst.args[0].toString()
          switch (op) {
            case 'always':
              if (inst.branch === insts[0] && (
                  !inst.options.endAsJump || printJumpLabel)) {
                inst.op = 'end'
                inst.args.length = 0
              } else if (inst.branch === inst && (
                  !inst.options.stopAsJump || printJumpLabel)) {
                inst.op = 'stop'
                inst.args.length = 0
              } else {
                inst.args[1] ||= Token.ZERO
                inst.args[2] ||= Token.ZERO
              }
              break
            case 'strictNotEqual':
              inst.args[0] = Instruction.NOT_EQUAL
              break
            case 'never':
              inst.args[0] = Instruction.NOT_EQUAL
              inst.args[1] = Token.ZERO
              inst.args[2] = Token.ZERO
              break
          }
        } else if (inst.op === 'set') {
          if (inst.branch) {
            inst.args.push(new Token(
              inst.branch.index.toString(), Token.NUMERIC))
            inst.branch = null
          }
        } else if (inst.op === 'write') {
          if (inst.branch) {
            inst.args.unshift(new Token(
              inst.branch.index.toString(), Token.NUMERIC))
            inst.branch = null
          }
        }
      }

      while (insts.length > 0 && insts[insts.length - 1].op === 'end') {
        insts.pop()
      }

      return insts
    }
  }


  return {
    Token, Line, Instruction, CompilerError, Program,

    /** @type {Object<string, string>} */
    colors: {
      inputOutput: 'A08A8A', blockControl: 'D4816B', operations: '877BAD',
      flowControl: '6BB2B2', unitControl: 'C7B59D', world: '6B84D4',
    },
    opcodes,
  }
})
