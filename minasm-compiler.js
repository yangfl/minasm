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
      'read', 'write', 'draw', 'print', 'drawflush', 'printflush',
      'getlink', 'control', 'radar', 'sensor',
      'set', 'op', 'wait', 'lookup',
      'end', 'jump',
      'ubind', 'ucontrol', 'uradar', 'ulocate',
    ],

    // instructions by types
    memory: [
      'read', 'write', 'draw', 'print', 'drawflush', 'printflush',
    ],
    block: [
      'getlink', 'control', 'radar', 'sensor',
    ],
    variable: [
      'set', 'op', 'wait', 'lookup',
    ],
    flow: [
      'end', 'jump',
    ],
    unit: [
      'ubind', 'ucontrol', 'uradar', 'ulocate',
    ],

    // instruction opcodes
    draw: [
      'clear', 'color', 'stroke', 'line', 'rect', 'lineRect',
      'poly', 'linePoly', 'triangle', 'image',
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
      'move', 'approach',
      'boost', 'pathfind',
      'target', 'targetp',
      'itemDrop', 'itemTake',
      'payDrop', 'payTake',
      'payEnter', 'mine',
      'flag', 'build',
      'getBlock', 'within',
    ],
    ulocate: [
      'ore', 'building', 'spawn', 'damaged',
    ],
    building: [
      'core', 'storage',
      'generator', 'turret',
      'factory', 'repair',
      'rally', 'battery',
      'reactor',
    ],
  }

  /**
   * @implements {Iterator<[number, Token], undefined>}
   * @implements {Iterable<[number, Token]>}
   */
  class TokenIterator {
    /**
     * @param {string} str Input string.
     * @param {boolean} keepWhitespace Whether to keep whitespace tokens.
     * @param {number} start Starting position.
     */
    constructor (str, keepWhitespace = false, start = 0) {
      /**
       * input string
       * @type {string}
       */
      this.str = str
      /**
       * string pointer, `-1` is EOF
       * @type {number}
       */
      this.i = this.str ? start : -1
      /**
       * whether to keep whitespace tokens
       * @type {boolean}
       */
      this.keepWhitespace = keepWhitespace
    }

    [Symbol.iterator] () {
      return this
    }

    next () {
      while (this.i >= 0) {
        const [type, end] = Token.detect(this.str, this.i)
        if (this.i >= end) {
          debugger
          throw Error('internal error')
        }
        const start = this.i
        this.i = end >= this.str.length ? -1 : end
        if (this.keepWhitespace || type !== Token.WHITESPACE) {
          return {
            done: false,
            value: [start, new Token(this.str.substring(start, end), type)]
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
    static WHITESPACE = 0
    static IDENTIFIER = 1
    static STRING = 2
    static NUMERIC = 3
    static OPERATOR = 4
    static COMMENT = 5

    /**
     * @param {string} str Token content.
     * @param {number} type Token type.
     */
    constructor (str, type = Token.IDENTIFIER) {
      /**
       * token type
       * @type {number}
       */
      this.type = type
      /**
       * token content
       * @type {string}
       */
      this.str = str
    }

    /**
     * Detect token type.
     * @param {string} str Input string.
     * @param {number} start Starting position.
     * @returns {number} Token type.
     */
    static detectType (str, start = 0) {
      const char = str[start]
      if (char === '#') {
        return Token.COMMENT
      }
      if (char === '"') {
        return Token.STRING
      }
      if (/^[+-]?\.?\d/.test(str.slice(start, start + 3))) {
        return Token.NUMERIC
      }
      if ('=><!~?:&|+-*/\^%.[]'.includes(char)) {
        return Token.OPERATOR
      }
      if (char.trim()) {
        return Token.IDENTIFIER
      }
      return Token.WHITESPACE
    }

    /**
     * Detect token type and length.
     * @param {string} str Input string.
     * @param {number} start Starting position.
     * @returns {[number, number]} Token type and end position.
     */
    static detect (str, start = 0) {
      const length = str.length
      const type = Token.detectType(str, start)
      let regex
      switch (type) {
        case Token.WHITESPACE:
          regex = /\S/
          break
        case Token.IDENTIFIER:
          regex = /[\s.\[\]%]/
          break
        case Token.NUMERIC:
          regex = /[\s\[\]%]/
          break
        case Token.STRING: {
          let end = start + 1
          while (true) {
            const result = matchFrom(str, /["\\\n]/, end)
            if (!result) {
              return [type, length]
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
                return [type, end]
            }
          }
        }
        case Token.OPERATOR:
          regex = /[^=><!~?:&|+\-*/\\^%.\[\]]/
          break
        case Token.COMMENT: {
          const end = str.indexOf('\n', start)
          return [type, end < 0 ? length : end]
        }
      }
      return [type, matchFrom(str, regex, start)?.index || length]
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
      return this.type === Token.NUMERIC || this.type === Token.STRING
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
        default:
          return this.toString()
      }
    }

    /**
     * Test if token is of a given type or string.
     * @param {number | string} want Wanted token type or string.
     * @returns {boolean} `true` if matched.
     */
    match (want) {
      return typeof want === 'string' ?
        want === this.toString() : want === this.type
    }
  }

  /**
   * A parsed line.
   */
  class Line {
    /**
     * @param {Iterable<Token>} tokens
     * @param {string} indent
     */
    constructor (tokens, indent = '') {
      /**
       * Tokens.
       * @type {Token[]}
       */
      this.tokens = Array.isArray(tokens) ? tokens : Array.from(tokens)
      /**
       * Indentation.
       * @type {string}
       */
      this.indent = indent
    }

    /**
     * Parse line.
     * @param {string} str Input string.
     * @returns {Line} Parsed line.
     */
    static fromString (str) {
      return new Line(
        Array.from(Token.split(str)).map(x => x[1]),
        str.match(/^\s+/)?.[0] || undefined)
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
     * @param {Instruction} start Instruction to start from.
     */
    constructor (start) {
      /** @type {Instruction[]} */
      this.stack = []
      /** @type {Set<Instruction>} */
      this.result = new Set
      /** @type {Instruction?} */
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
      Array.from(Instruction.reverseCondition)
       .map(([key, value]) => [key, new Token(value)]))

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

    static tokenAlways = Instruction.reverseConditionToken.get('never')
    static tokenNever = Instruction.reverseConditionToken.get('always')
    static tokenNotEqual = Instruction.reverseConditionToken.get('equal')

    static padding = new Token('0', Token.NUMERIC)
    static tokenCounter = new Token('@counter')
    static tokenFalse = new Token('false')
    static tokenLabelStart = new Token('_start')

    /**
     * @param {string} op Instruction operator.
     * @param {Token[]} args Instruction arguments.
     * @param {number} index Line number, for debugging and code gen.
     * @param {string} indent Indentation, for code gen.
     * @param {Token[]} tokens Original tokens, for code gen.
    */
    constructor (op, args = [], index = -1, indent = '', tokens = []) {
      /**
       * instruction operator
       * @type {string}
       */
      this.op = op
      /**
       * instruction arguments
       * @type {Token[]}
       */
      this.args = Array.isArray(args) ? args : Array.from(args)

      /**
       * next instruction, also the false branch when instruction is a jump
       * @type {Instruction?}
       */
      this.next = null
      /**
       * the true branch when instruction is a jump
       * @type {Instruction?}
       */
      this.branch = null
      /**
       * disable dead code elimination
       * @type {boolean}
       */
      this.noOptimize = false

      /**
       * jump label, for debugging
       * @type {string}
       */
      this.label = null
      /**
       * line number, for debugging and code gen
       * @type {number}
       */
      this.index = index
      /**
       * indentation, for code gen
       * @type {string}
       */
      this.indent = indent
      /**
       * original tokens, for code gen
       * @type {Token[]}
       */
      this.tokens = Array.isArray(tokens) ? tokens : Array.from(tokens)
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
        return [Instruction.tokenNotEqual, args[0], Instruction.tokenFalse]
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
     * @returns {[string, Token[]]?} Mindustry instruction operator and arguments.
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

      const token2Str = tokens[2].toString()
      let op
      if (assign === '=') {
        if (tokens.length === 2) {
          // x =
          // 0 1
          return ['set', args]
        }
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
            args.push(Instruction.padding)
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
            args.push(Instruction.padding)
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
     * @returns {[string, Token[], Token?]} Mindustry instruction operator,
     *  arguments, and label of branch target if instruction is a jump.
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
          return ['end', Instruction.decodeCondition(args)]
        case 'jump': {
          const branch = args.shift()
          return ['jump', Instruction.decodeCondition(args), branch]
        }
        case 'control':
        case 'ucontrol':
          while (args.length < 7) {
            args.push(Instruction.padding)
          }
          break
        case 'draw':
        case 'ulocate':
          while (args.length < 8) {
            args.push(Instruction.padding)
          }
          break
        case 'read':
        case 'write':
        case 'print':
        case 'drawflush':
        case 'printflush':
        case 'getlink':
        case 'radar':
        case 'sensor':
        case 'set':
        case 'op':
        case 'wait':
        case 'lookup':
        case 'ubind':
        case 'uradar':
          break
        default:
          args.unshift(tokens[0])
          return Instruction.decodeAssignment(args) ||
            [tokens[0].toString(), args.slice(1)]
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
        this.args[0] = Instruction.tokenNever
      }
      return ret
    }

    /**
     * whether instruction is generated from a Minasm macro
     * @type {boolean}
     */
    get isMacro () {
      return this.tokens[0]?.toString() === '.'
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
     * @param {Instruction} initiator Loop detector.
     * @returns {Instruction?} Target instruction, or null if not an
     *  unconditional jump.
     */
    getTarget (jumpCallee = false, initiator = null) {
      if (initiator === this) {
        // loop detected
        return this
      }
      if (!this.isJump) {
        // not a jump
        return null
      }
      if (!jumpCallee && this.noOptimize) {
        // prevent jump optimization
        return null
      }
      const jumpDirection = this.jumpDirection
      if (jumpDirection == 0) {
        // not an unconditional jump
        return null
      }

      if (jumpDirection > 0) {
        const target = this.next?.getTarget(true, initiator || this)
        if (target) {
          this.next = target
        }
        return this.next
      } else {
        const target = this.branch?.getTarget(true, initiator || this)
        if (target) {
          this.branch = target
        }
        return this.branch
      }
    }

    toString (withToken = false) {
      let str = ''
      if (0) {
        str = this.index.toString().padStart(2) + ' [' +
          (this.next ? this.next.index.toString().padStart(2) : '  ') + ']: '
      }

      str += (this.indent || '') + this.op
      if (this.isJump) {
        str += ' ' + (this.branch ? this.branch.index : '<null>')
      }
      if (this.args && this.args.length !== 0) {
        str += ' ' + this.args.join(' ')
      }

      if (withToken || this.isMacro) {
        if (this.isMacro) {
          str += '  # .' + this.tokens.slice(1).join(' ')
        } else {
          str += '  # ' + this.tokens.join(' ')
        }
      }
      return str
    }

    /**
     * Flip jump condition.
     */
    reverseJump () {
      if (this.args.length === 0) {
        this.args.push(Instruction.tokenNever)
      } else {
        const reversedConditionToken = Instruction.reverseConditionToken.get(
          this.args[0].toString())
        if (reversedConditionToken === Instruction.tokenAlways) {
          this.args.length = 0
        } else if (reversedConditionToken) {
          this.args[0] = reversedConditionToken
        }
      }

      const tmp = this.next
      this.next = this.branch
      this.branch = tmp
    }

    /**
     * Find the final targets of branches, and try to make sure the line number
     * of next instruction is greater than the one of itself.
     * @returns {boolean} Whether the branch targets were changed.
     */
    normalize () {
      const jumpDirection = this.isJump ? this.jumpDirection : 0

      const oldNext = this.next
      do {
        if (!this.next?.getTarget) {
          break
        }
        if (this.isJump && !this.noOptimize && jumpDirection < 0) {
          this.next = null
          break
        }

        const next = this.next.getTarget(this.isJump)
        if (!next) {
          break
        }
        if (this.isJump && next === this.branch) {
          this.args.length = 0
          this.next = null
          break
        }
        this.next = next
      } while (false)

      const oldBranch = this.branch
      do {
        if (!this.branch?.getTarget) {
          break
        }
        if (this.isJump && !this.noOptimize && jumpDirection > 0) {
          this.branch = null
          break
        }

        const branch = this.branch.getTarget(this.isJump)
        if (!branch) {
          break
        }
        if (this.isJump && branch === this.next) {
          this.args[0] = Instruction.tokenNever
          this.args.length = 1
          this.branch = null
          break
        }
        this.branch = branch
      } while (false)

      const normalized = oldNext !== this.next || oldBranch !== this.branch
      if (this.isJump && this.next?.getTarget) {
        if (!this.branch?.getTarget) {
          this.reverseJump()
        } else {
          const b = this.branch.index - this.index
          const n = this.next.index - this.index
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
            }
          } else if (b * n > 0 ? b < n : b > n) {
            this.reverseJump()
          }
        }
      }
      return normalized
    }
  }

  /**
   * Compiler error.
   */
  class CompilerError extends Error {
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

  /**
   * @typedef ProgramBlock
   * name, begin, end[]
   * @type {[string, Instruction?, Instruction[]]}
   */

  /**
   * Complete source code.
   * @implements {Iterable<Instruction>}
   */
  class Program {
    constructor () {
      /**
       * program head
       * @type {Instruction}
       */
      this.head = new Instruction('jump', [Instruction.tokenNever])
      /**
       * program tail
       * @type {Instruction?}
       */
      this.tail = this.head

      /**
       * labeled instructions
       * @type {Map<string, Instruction>}
       */
      this.labels = new Map
      this.labels.set(Instruction.tokenLabelStart.toString(), this.head)
      /**
       * instructions that within this relative line number range
       * @type {Instruction[]}
       */
      this.relinsts = []

      /**
       * label name of next instruction
       * @type {string?}
       */
      this.label = null
      /**
       * disable dead code elimination
       * @type {boolean}
       */
      this.noOptimize = false

      /**
       * source block stack
       * @type {ProgramBlock[]}
       */
      this.stack = []
      /**
       * jump instruction of block
       * @type {Instruction[]}
       */
      this.blockEnds = []
    }

    [Symbol.iterator] () {
      return this.head[Symbol.iterator]()
    }

    /**
     * @param {string} name
     * @param {Instruction} begin
     * @param {Instruction[]} end
     * @returns {ProgramBlock}
     */
    addBlock (name, begin, end = []) {
      const block = [name, begin, end]
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
        block[0] === blockStart : blockStart.includes(block[0]))
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
          block[1] ? block[1].index :
          block[2].length !== 0 ? block[2].at(-1).index : undefined)
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
     * @param {string} blockEnd
     * @param {number} lineNumber
     * @returns {ProgramBlock}
     */
    findBlock (blockStart, blockEnd, lineNumber = -1) {
      for (let i = this.stack.length - 1; i >= 0; i--) {
        if (Program.matchBlock(this.stack[i], blockStart)) {
          return this.stack[i]
        }
      }
      return Program.testBlock(null, blockStart, blockEnd, lineNumber)
    }

    endBlock () {
      this.blockEnds.push(...this.stack.pop()[2])
    }

    /**
     * @param {Instruction} inst
     * @param {boolean} endLike
     */
    push (inst, endLike = false) {
      inst.noOptimize = this.noOptimize

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
      if (this.label) {
        inst.label = this.label
        this.labels.set(this.label, inst)
        this.label = null
      }

      // mark relative line number
      if (!inst.isMacro) {
        this.relinsts.push(inst)
      }
    }

    /**
     * @param {number} lineNumber
     * @param {number} newRelindex
     */
    resetRelinsts (lineNumber = -1, newRelindex = 0) {
      while (this.relinsts.length !== 0 &&
             !this.relinsts[this.relinsts.length - 1]) {
        this.relinsts.length--
      }

      for (let i = 0; i < this.relinsts.length; i++) {
        const inst = this.relinsts[i]
        if (!inst || !inst.isJump) {
          continue
        }
        let target = inst.branch
        if (typeof target !== 'number') {
          continue
        }
        if (target >= this.relinsts.length) {
          throw new CompilerError(
            'relative jump out of range, want ' + target +
            ', but max is ' + (this.relinsts.length - 1), lineNumber)
        }
        do {
          inst.branch = this.relinsts[target]
          target++
        } while (!inst.branch)
      }

      this.relinsts.length = 0
      this.relinsts.length = newRelindex
    }

    resolveLabels () {
      for (const inst of this) {
        const label = inst.branch
        if (typeof label === 'string') {
          inst.branch = this.labels.get(label)
          if (!inst.branch) {
            throw new CompilerError(
              'unknown label `' + label + "'", inst.index)
          }
        }
      }
    }

    /**
     * @param {number} lineNumber
     * @returns {boolean}
     */
    finish (lineNumber = -1) {
      if (this.stack.length !== 0) {
        const block = this.stack[this.stack.length - 1]
        throw new CompilerError(
          'unmatched ' + block[0], lineNumber, block[1].index)
      }

      this.resetRelinsts(lineNumber)

      // mark instruction by label
      if (this.label) {
        this.head.label = this.label
        this.labels.set(this.label, this.head)
        this.label = null
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

      const lines = code.split('\n')
      /** @type {Instruction[]} */
      for (let i = 0; i < lines.length; i++) {
        const line = Line.fromString(lines[i])
        const tokens = line.tokens
        if (tokens.length === 0) {
          program.relinsts.length++
          continue
        }
        const indent = line.indent

        // process normal instructions
        if (tokens[0].type === Token.IDENTIFIER) {
          const [op, args, branch] = Instruction.decode(tokens)
          const inst = new Instruction(op, args, i, indent, tokens)
          if (branch) {
            inst.branch = branch.toValue()
          } else if (op === 'end') {
            inst.op = 'jump'
            inst.branch = Instruction.tokenLabelStart.toString()
          }
          program.push(inst)
          continue
        }

        // process macros
        if (tokens[0].toString() !== '.') {
          program.relinsts.length++
          continue
        }
        if (tokens[1]?.type !== Token.IDENTIFIER) {
          continue
        }
        const token2 = tokens[2]

        const macro = tokens[1].toString()
        switch (macro) {
          case 'fun':
            if (stackCell === null) {
              throw new CompilerError('stack cell is not defined', i)
            }
            // fallthrough
          case 'label':
            if ([Token.IDENTIFIER, Token.STRING].includes(token2?.type)) {
              program.label = token2.toString()
              if (program.labels.has(program.label) &&
                  !program.label.startsWith('_')) {
                throw new CompilerError(
                  'duplicate label `' + program.label + "'", i,
                  program.labels.get(program.label).index - 1)
              }
            }

            if (macro === 'fun') {
              program.push(new Instruction(
                'op', [
                  new Token('sub'), stackPointer, stackPointer,
                  new Token('1', Token.NUMERIC)], i, indent, tokens))
            }
            break
          case 'rel':
            program.resetRelinsts(i - 1, token2?.toNumber() || 0)
            break
          // stack push pop
          case 'stack':
            if (token2?.type === Token.IDENTIFIER) {
              stackCell = new Token(token2.toString())
              const stackSize = tokens[3]?.toNumber() || 64
              program.push(new Instruction(
                'set', [
                  stackPointer,
                  new Token((stackSize - 1).toString(), Token.NUMERIC)
                ], i, indent, tokens))
            }
            break
          case 'push': {
            if (stackCell === null) {
              throw new CompilerError('stack cell is not defined', i)
            }
            if (token2) {
              program.push(new Instruction(
                'write', [
                  new Token(token2.toString()), stackCell, stackPointer],
                i, indent, tokens))
            }
            program.push(new Instruction(
              'op', [
                new Token('sub'), stackPointer, stackPointer,
                new Token('1', Token.NUMERIC)], i + 0.5, indent, tokens))
            break
          }
          case 'pushn': {
            if (stackCell === null) {
              throw new CompilerError('stack cell is not defined', i)
            }
            program.push(new Instruction(
              'op', [
                new Token('sub'), stackPointer, stackPointer,
                token2 || new Token('1', Token.NUMERIC)], i, indent, tokens))
            break
          }
          case 'pop': {
            if (stackCell === null) {
              throw new CompilerError('stack cell is not defined', i)
            }
            program.push(new Instruction(
              'op', [
                new Token('add'), stackPointer, stackPointer,
                new Token('1', Token.NUMERIC)], i, indent, tokens))
            if (token2) {
              program.push(new Instruction(
                'read', [
                  new Token(token2.toString()), stackCell, stackPointer],
                i + 0.5, indent, tokens))
            }
            break
          }
          case 'popn': {
            if (stackCell === null) {
              throw new CompilerError('stack cell is not defined', i)
            }
            program.push(new Instruction(
              'op', [
                new Token('add'), stackPointer, stackPointer,
                token2 || new Token('1', Token.NUMERIC)], i, indent, tokens))
            break
          }
          // call ret
          case 'call': {
            if (stackCell === null) {
              throw new CompilerError('stack cell is not defined', i)
            }
            if (![Token.IDENTIFIER, Token.STRING].includes(token2?.type)) {
              throw new CompilerError('no function name', i)
            }

            const instSave = new Instruction(
              'write', [stackCell, stackPointer], i, indent, tokens)
            program.push(instSave)

            const inst = new Instruction('jump', [], i, indent, tokens)
            inst.branch = token2.toString()
            program.push(inst, true)

            program.blockEnds.push(instSave)
            break
          }
          case 'retl':
          case 'ret': {
            if (stackCell === null) {
              throw new CompilerError('stack cell is not defined', i)
            }

            if (macro === 'ret') {
              program.push(new Instruction(
                'op', [
                  new Token('add'), stackPointer, stackPointer,
                  new Token('1', Token.NUMERIC)], i, indent, tokens))
            }
            program.push(new Instruction(
              'read', [
                Instruction.tokenCounter, stackCell, stackPointer],
              i + 0.5, indent, tokens), true)
            break
          }
          // int reti
          case 'int': {
            if (![Token.IDENTIFIER, Token.STRING].includes(token2?.type)) {
              throw new CompilerError('no interrupt handler', i)
            }
            const handler = token2.toString()

            const instSave = new Instruction(
              'set', [new Token(
                interruptPrefix + (tokens[3]?.toString() || handler))],
              i, indent, tokens)
            program.push(instSave)

            const inst = new Instruction('jump', [], i + 0.5, indent, tokens)
            inst.branch = handler
            program.push(inst, true)

            program.blockEnds.push(instSave)
            break
          }
          case 'reti': {
            if (![Token.IDENTIFIER, Token.STRING].includes(token2?.type)) {
              throw new CompilerError('no interrupt handler', i)
            }
            const handler = token2.toString()

            program.push(new Instruction(
              'set', [
                Instruction.tokenCounter, new Token(interruptPrefix + handler)],
              i, indent, tokens), true)
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
              'jump', Instruction.decodeCondition(tokens.slice(2)),
              i, indent, tokens)
            inst.reverseJump()
            program.push(inst)

            program.addBlock('if', inst, [inst])
            break
          }
          case 'elif': {
            const block = program.testBlock('if', 'elif', i)

            const instEnd = new Instruction('jump', [], i, indent, tokens)
            program.push(instEnd)

            const inst = new Instruction(
              'jump', Instruction.decodeCondition(tokens.slice(2)),
              i, indent, tokens)
            inst.reverseJump()
            program.push(inst)

            block[1].branch = inst
            block[1] = inst
            block[2][block[2].length - 1] = instEnd
            block[2].push(inst)
            break
          }
          case 'else': {
            const block = program.testBlock('if', 'else', i)
            if (!block[1]) {
              throw new CompilerError(
                'excessive else', i, block[2].at(-1).index)
            }

            const instEnd = new Instruction('jump', [], i, indent, tokens)
            program.push(instEnd)

            const inst = new Instruction(
              'jump', [Instruction.tokenNever], i, indent, tokens)
            program.push(inst)

            block[1].branch = inst
            block[1] = null
            block[2][block[2].length - 1] = instEnd
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
            const block = program.findBlock(['while', 'do'], 'break', i)

            const inst = new Instruction(
              'jump', Instruction.decodeCondition(tokens.slice(2)),
              i, indent, tokens)
            program.push(inst)

            block[2].push(inst)
            break
          }
          case 'continue': {
            const block = program.findBlock(['while', 'do'], 'continue', i)

            const inst = new Instruction(
              'jump', Instruction.decodeCondition(tokens.slice(2)),
              i, indent, tokens)
            inst.branch = block[1]
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
              'jump', Instruction.decodeCondition(tokens.slice(2)),
              i, indent, tokens)
            inst.reverseJump()
            program.push(inst)

            program.addBlock('while', inst, [inst])
            break
          }
          case 'done': {
            const block = program.testBlock('while', 'done', i)

            const inst = new Instruction(
              'jump', block[1].args.slice(), i, indent, tokens)
            inst.reverseJump()
            program.push(inst)
            inst.branch = block[1].next

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
            const inst = new Instruction(
              'jump', [Instruction.tokenNever], i, indent, tokens)
            program.push(inst)

            program.addBlock('do', inst)
            break
          }
          case 'when': {
            const block = program.testBlock('do', 'when', i)

            const inst = new Instruction(
              'jump', Instruction.decodeCondition(tokens.slice(2)),
              i, indent, tokens)
            inst.branch = block[1]
            program.push(inst)

            program.endBlock()
            break
          }
          case 'until': {
            const block = program.testBlock('do', 'until', i)

            const inst = new Instruction(
              'jump', Instruction.decodeCondition(tokens.slice(2)),
              i, indent, tokens)
            inst.reverseJump()
            inst.branch = block[1]
            program.push(inst)

            program.endBlock()
            break
          }
          // case stop esac
          case 'case': {
            const inst = token2 ?
              new Instruction(
                'op', [new Token('add'), Instruction.tokenCounter,
                       Instruction.tokenCounter, token2],
                i, indent, tokens) :
              new Instruction(
                'jump', [Instruction.tokenNever], i, indent, tokens)
            program.push(inst)
            program.addBlock('case', inst)
            program.noOptimize = true

            break
          }
          case 'stop': {
            const block = program.findBlock('case', 'stop', i)

            const inst = new Instruction(
              'jump', Instruction.decodeCondition(tokens.slice(2)),
              i, indent, tokens)
            program.push(inst)

            block[2].push(inst)
            break
          }
          case 'esac': {
            const block = program.testBlock('case', 'esac', i)
            program.noOptimize = false

            program.endBlock()
            break
          }
          default:
            throw new CompilerError(
              'unknown macro `' + tokens[1].toString() + "'", i)
        }
      }

      const changed = program.finish(lines.length - 1)
      program.deadcodeEliminate(changed)

      // codegen
      const rawInsts = Array.from(program).sort((a, b) => a.index - b.index)
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
          const newInst = new Instruction(
            'jump', [], inst.index + 1, inst.indent)
          newInst.branch = inst.next
          inst.next = newInst

          newInst.index = insts.length
          insts.push(newInst)
        }
      }

      // fix jumps
      for (let i = 0; i < insts.length; i++) {
        const inst = insts[i]
        if (inst.isJump) {
          if (inst.args.length === 0) {
            if (inst.branch === insts[0]) {
              inst.op = 'end'
            } else {
              inst.args.push(
                Instruction.tokenAlways, Instruction.padding,
                Instruction.padding)
            }
            continue
          }

          const op = inst.args[0].toString()
          switch (op) {
            case 'always':
              if (inst.branch === insts[0]) {
                inst.op = 'end'
                inst.args.length = 0
              } else {
                inst.args[1] ||= Instruction.padding
                inst.args[2] ||= Instruction.padding
              }
              break
            case 'strictNotEqual':
              inst.args[0] = Instruction.reverseConditionToken.get('equal')
              break
            case 'never':
              inst.args[0] = Instruction.reverseConditionToken.get('equal')
              inst.args[1] = Instruction.padding
              inst.args[2] = Instruction.padding
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

      return insts
    }
  }

  return {
    /** @type {Object<string, string>} */
    colors: {
      memory: 'A08A8A', block: 'D4816B', variable: '877BAD',
      flow: '6BB2B2', unit: 'C7B59D',
    },
    opcodes,

    Token, Instruction, CompilerError, Program,
  }
})
