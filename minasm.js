'use strict'


let jsUrl = document.getElementsByTagName('script')[0].src
jsUrl = jsUrl.substring(0, jsUrl.lastIndexOf('/'))

require.config({
  paths: {
    vs: jsUrl,
  },
})


const cultureDists = {
  // 'en-us': 'en-us',
  'zh-cn': 'zh-cn',
  'zh-tw': 'zh-tw',
  'zh-hk': 'zh-tw',
  'ja-jp': 'ja',
  'ko-kr': 'ko',
  'de-de': 'de',
  'fr-fr': 'fr',
  'it-it': 'it',
  'es-es': 'es',
  'ru-ru': 'ru'
}

const uiCulture = window.navigator.language.toLowerCase()
const uiLanguage = cultureDists[uiCulture]
if (uiLanguage !== undefined) {
  require.config({
    'vs/nls' : {
      availableLanguages: {
        '*': uiLanguage
      },
    },
  })
}


require(['vs/editor/editor.main'], function () {
  monaco.editor.defineTheme('MindustryTheme', {
    base: 'vs',
    inherit: true,
    rules: [
      {token: 'keyword.inputOutput', foreground: Minasm.colors.inputOutput},
      {token: 'keyword.blockControl', foreground: Minasm.colors.blockControl},
      {token: 'keyword.operations', foreground: Minasm.colors.operations},
      {token: 'keyword.flowControl', foreground: Minasm.colors.flowControl},
      {token: 'keyword.unitControl', foreground: Minasm.colors.unitControl},
      {token: 'keyword.world', foreground: Minasm.colors.world},
      {token: 'keyword.invalid', foreground: 'FF0000', fontStyle: 'bold'},
    ],
    colors: {
      'editor.foreground': '#000000',
    },
  })

  monaco.languages.register({id: 'Mindustry'})
  monaco.languages.register({id: 'Minasm'})

  /**
   * @implements {monaco.languages.IState}
   */
  class MindustryLineState {
    clone () {
      return new this.constructor
    }

    equals (other) {
      return true
    }
  }

  const tokensProvider = {
    getInitialState () {
      return new MindustryLineState
    },

    tokenize (line, state) {
      // collect tokens
      /** @type {{
       *  startIndex: number;
       *  scopes: string;
       *  token: Minasm.Token;
       * }[]} */
      const tokens = []
      let inMacro = false
      for (const [startIndex, token] of Minasm.Token.split(line)) {
        let scopes
        switch (token.type) {
          case Minasm.Token.IDENTIFIER:
            if (inMacro) {
              inMacro = false
              continue
            }
            if (token.toString()[0] === '@') {
              scopes = 'keyword'
              break
            }
            scopes = 'identifier'
            break
          case Minasm.Token.BUILTIN:
            scopes = 'keyword'
            break
          case Minasm.Token.STRING:
            scopes = 'string'
            break
          case Minasm.Token.NUMERIC:
            scopes = 'number'
            break
          case Minasm.Token.OPERATOR:
            if (tokens.length === 0 && token.toString() === '.') {
              scopes = 'keyword.macro'
              inMacro = true
              break
            }
            scopes = 'operator'
            break
          case Minasm.Token.COMMENT:
            scopes = 'comment'
            break
        }
        tokens.push({startIndex, scopes, token})
      }

      // mark instructions
      do {
        // check instructions
        if (tokens.length === 0) {
          break
        }
        const token0 = tokens[0]
        if (token0.scopes !== 'identifier') {
          break
        }
        const op0 = token0.token.toString()

        /** @type {string} */
        let scopes = null
        for (const type in Minasm.colors) {
          if (Minasm.opcodes[type].includes(op0)) {
            scopes = 'keyword.' + type
            token0.scopes = scopes
            break
          }
        }
        if (scopes === null) {
          break
        }

        // check op1
        if (tokens.length === 1) {
          break
        }
        const token1 = tokens[1]
        if (token1.scopes !== 'identifier' &&
            op0 !== 'jump' && op0 !== 'status') {
          break
        }
        const op1 = token1.token.toString()

        let checked = false
        for (const ins of [
            'draw', 'control', 'op', 'lookup', 'ucontrol',
            'getblock', 'setblock', 'setrule', 'message', 'cutscene', 'fetch',
        ]) {
          if (op0 === ins) {
            checked = true
            if (Minasm.opcodes[ins].includes(op1)) {
              token1.scopes = scopes
            }
            break
          }
        }
        if (checked) {
          break
        }

        // check ops
        const token2 = tokens[2]
        const op2 = token2?.scopes === 'identifier' && token2.token.toString()
        const token3 = tokens[3]
        const op3 = token3?.scopes === 'identifier' && token3.token.toString()
        if (op0 === 'radar' || op0 === 'uradar') {
          if (!Minasm.opcodes.radar.includes(op1)) {
            break
          }
          token1.scopes = scopes
          if (!Minasm.opcodes.radar.includes(op2)) {
            break
          }
          token2.scopes = scopes
          if (!Minasm.opcodes.radar.includes(op3)) {
            break
          }
          token3.scopes = scopes
        } else if (op0 === 'jump') {
          if (Minasm.opcodes.jump.includes(op2)) {
            token2.scopes = scopes
            break
          }
          if (Minasm.opcodes.jump.includes(op3)) {
            token3.scopes = scopes
            break
          }
        } else if (op0 === 'ulocate') {
          if (!Minasm.opcodes.ulocate.includes(op1)) {
            break
          }
          token1.scopes = scopes
          if (op1 === 'building') {
            if (Minasm.opcodes.building.includes(op2)) {
              token2.scopes = scopes
            }
          }
        } else if (op0 === 'status') {
          if (Minasm.opcodes.status.includes(op2)) {
            token2.scopes = scopes
          }
        }
      } while (false)

      return {
        tokens,
        endState: new MindustryLineState,
      }
    },
  }
  monaco.languages.setTokensProvider('Mindustry', tokensProvider)
  monaco.languages.setTokensProvider('Minasm', tokensProvider)

  const macroPairs = new Set([
    ['if', 'elif'],
    ['if', 'else'],
    ['if', 'fi'],
    ['elif', 'elif'],
    ['elif', 'else'],
    ['elif', 'fi'],
    ['else', 'fi'],
    ['while', 'done'],
    ['do', 'when'],
    ['do', 'until'],
    ['for', 'endfor'],
    ['case', 'esac'],
  ].map(x => x.join()))
  monaco.languages.registerFoldingRangeProvider('Minasm', {
    provideFoldingRanges (model, context, token) {
      /** @type {monaco.languages.FoldingRange[]} */
      const ranges = []
      /** @type {monaco.languages.FoldingRange[]} */
      const stack = []
      const n = model.getLineCount()

      for (let i = 1; i <= n; i++) {
        const line = model.getLineContent(i)
        const match = line.match(/^\s*\.\s*(\S+)/)
        if (!match) {
          continue
        }
        const macro = match[1]
        switch (macro) {
          case 'elif':
          case 'else':
          case 'fi':
          case 'done':
          case 'when':
          case 'until':
          case 'endfor':
          case 'esac':
            while (stack.length) {
              const range = stack.pop()
              range.end = i - 1
              if (range.start !== range.end) {
                ranges.push(range)
              }
              if (macroPairs.has(range.macro + ',' + macro)) {
                break
              }
            }
            if (macro !== 'elif' && macro !== 'else') {
              break
            }
            // fallthrough
          case 'if':
          case 'while':
          case 'do':
          case 'for':
          case 'case':
            stack.push({
              start: i,
              end: -1,
              kind: monaco.languages.FoldingRangeKind.Region,
              macro,
            })
            break
        }
      }

      while (stack.length) {
        const range = stack.pop()
        range.end = n
        if (range.start !== range.end) {
          ranges.push(range)
        }
      }
      return ranges
    },
  })

  /**
   * @param {string} keyword
   * @returns {monaco.languages.CompletionItem}
   */
  function keyword2suggestion (keyword) {
    return {
      label: keyword,
      kind: monaco.languages.CompletionItemKind.Keyword,
      insertText: keyword,
    }
  }

  /**
   * @param {string[]} keywords
   * @param {boolean} incomplete
   * @returns {monaco.languages.CompletionList}
   */
  function keywords2completionList (keywords, incomplete = false) {
    return {suggestions: keywords.map(keyword2suggestion), incomplete}
  }

  monaco.languages.registerCompletionItemProvider('Minasm', {
    provideCompletionItems (model, position, context, token) {
      do {
        const tokens = Minasm.Line.fromString(
          model.getLineContent(position.lineNumber)
            .slice(0, position.column - 1)).tokens
        const token0 = tokens.at(0)
        if (!token0) {
          // nothing
          break
        }
        const op0 = token0.toString() === 'uradar' ? 'radar' : token0.toString()

        // token0 completions
        const token1 = tokens.at(1)
        if (!token1) {
          if (Minasm.opcodes.root.some(x => x.startsWith(op0))) {
            return keywords2completionList(Minasm.opcodes.root)
          }
          break
        }

        // token1 completions
        if (op0 !== 'jump' && token1.type !== Minasm.Token.IDENTIFIER) {
          break
        }
        const token2 = tokens.at(2)
        if ([
              '.', 'draw', 'control', 'op', 'lookup', 'ucontrol',
            ].includes(op0)) {
          if (token2) {
            break
          }
          if (op0 !== '.') {
            return keywords2completionList(Minasm.opcodes[op0])
          }
          /** @type {monaco.languages.CompletionList} */
          const completionList = {
            suggestions: [
              {
                label: 'if',
                kind: monaco.languages.CompletionItemKind.Snippet,
                insertText: ['if ${1:condition}', '\t$0', '.fi'].join('\n'),
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                documentation: 'If Statement'
              },
              {
                label: 'if else',
                kind: monaco.languages.CompletionItemKind.Snippet,
                insertText: ['if ${1:condition}', '\t$2', '.else', '\t$0', '.fi'].join('\n'),
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                documentation: 'If-Else Statement'
              },
              {
                label: 'elif else',
                kind: monaco.languages.CompletionItemKind.Snippet,
                insertText: ['elif ${1:condition}', '\t$0', '.else'].join('\n'),
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                documentation: 'Elif-Else Statement'
              },
              {
                label: 'while done',
                kind: monaco.languages.CompletionItemKind.Snippet,
                insertText: ['while ${1:condition}', '\t$0', '.done'].join('\n'),
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                documentation: 'While-Done Statement'
              },
              {
                label: 'do when',
                kind: monaco.languages.CompletionItemKind.Snippet,
                insertText: ['do', '\t$0', '.when ${1:condition}'].join('\n'),
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                documentation: 'Do-When Statement'
              },
              {
                label: 'do until',
                kind: monaco.languages.CompletionItemKind.Snippet,
                insertText: ['do', '\t$0', '.until ${1:condition}'].join('\n'),
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                documentation: 'Do-Until Statement'
              },
              {
                label: 'for endfor',
                kind: monaco.languages.CompletionItemKind.Snippet,
                insertText: ['for ${1:condition}', '\t$0', '.endfor'].join('\n'),
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                documentation: 'For-Endfor Statement'
              },
              {
                label: 'case esac',
                kind: monaco.languages.CompletionItemKind.Snippet,
                insertText: ['case ${1:condition}', '\t$0', '.esac'].join('\n'),
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                documentation: 'Case-Esac Statement'
              },
            ],
          }
          for (const keyword of ['label', 'rel', 'call', 'ret', 'stack',
                                 'pragma old-wait']) {
            completionList.suggestions.push(keyword2suggestion(keyword))
          }
          return completionList
        }
        if (!token2) {
          if (['radar', 'ulocate'].includes(op0)) {
            return keywords2completionList(Minasm.opcodes[op0])
          }
          if (op0 === 'jump') {
            return
          }
          break
        }

        // token2 completions
        if (op0 !== 'jump' && token2.type !== Minasm.Token.IDENTIFIER) {
          break
        }
        const token3 = tokens.at(3)
        if (!token3) {
          if (['radar', 'jump'].includes(op0)) {
            return keywords2completionList(Minasm.opcodes[op0], op0 === 'jump')
          }
          if (op0 === 'ulocate' && token1.toString() === 'building') {
            return keywords2completionList(Minasm.opcodes.building)
          }
          break
        }
        if (op0 === 'jump' && Minasm.opcodes.jump.includes(token2.toString())) {
          break
        }
        if (op0 === 'ulocate') {
          break
        }

        // token3 completions
        if (op0 !== 'jump' && token3.type !== Minasm.Token.IDENTIFIER) {
          break
        }
        const token4 = tokens.at(4)
        if (!token4) {
          if (['radar', 'jump'].includes(op0)) {
            return keywords2completionList(Minasm.opcodes[op0])
          }
          break
        }
      } while (false)
      return // keywords2completionList(['true', 'false', 'null'], true)
    }
  })

  const source = document.getElementById('source')
  source.textContent = ''
  const sourceEditor = monaco.editor.create(source, {
    language: 'Minasm',
    theme: 'MindustryTheme',
    automaticLayout: true,
    lineNumbers: x => (x - 1).toString(),
  })

  const result = document.getElementById('result')
  result.textContent = ''
  const resultEditor = monaco.editor.create(result, {
    language: 'Mindustry',
    theme: 'MindustryTheme',
    automaticLayout: true,
    readOnly: true,
    lineNumbers: x => (x - 1).toString(),
  })

  sourceEditor.onDidChangeModelContent(function (event) {
    const content = sourceEditor.getValue()
    localStorage.setItem('minasm', content)

    /** @type {string} */
    let result
    try {
      result = Minasm.Program.compile(content).join('\n')
    } catch (e) {
      if (!(e instanceof Minasm.CompilerError)) {
        console.error(e)
      }
      result = e.toString()
    }

    resultEditor.setValue(result)
  })

  sourceEditor.setValue(localStorage.getItem('minasm') ||
`print "by：[orange]awa[]\n文明搬运豆，无资源时释放单位"
printflush message1

.if bInit == false
  .do
    ubind @flare
  .until @unit !== null
  mUnit = @unit.@type
  mItem = @titanium
  #mItem = null
  mItem2 = null
  mItem3 = null
  mItem4 = null
  nThreshold = 5

  xThis = floor @thisx
  yThis = floor @thisy
  nThisFlag = yThis * @mapw
  nThisFlag += xThis

  bInit = true
.fi

.if switch1 !== null
  bSwitch = switch1.@enabled
  .if bSwitch == false
    ucontrol flag 0
    ucontrol unbind
    end
  .fi
.fi

# read preset
.if mItem !== null
  .case iItem2
    mItemCur = mItem2
    .stop
    mItemCur = mItem3
    .stop
    mItemCur = mItem4
    .stop
    mItemCur = null
  .esac
  .if mItemCur === null
    mItemCur = mItem
    iItem2 = 0
  .else
    iItem2 += 2
  .fi
.fi

bUsed = false
iTarget = 0
.while iTarget < @links
  # read config
  .if mItemCur !== null
    mWanted = mItemCur
  .else
    .do
      mWanted = sorter1.@config
    .when mWanted === null
  .fi

  # get link
  dTarget = %iTarget
  iTarget += 1
  .int tryCarrier
  bUsed ||= tryCarrier_bOk
.done

.if bUsed == false
  .if bLastUsed
    ucontrol flag 0
    ucontrol unbind
  .fi
.fi
bLastUsed = bUsed

end


.label tryCarrier dTarget mWanted nThreshold
tryCarrier_bOk = false
nTargetCapacity = dTarget.@itemCapacity
.if nTargetCapacity >= 10
  .while
    nTargetItems = dTarget.mWanted
    nTargetItems += nThreshold
    .break nTargetItems >= nTargetCapacity

    .if dCore !== null
      bCoreDead = dCore.@dead
      .if bCoreDead
        dCore = null
      .else
        nCoreItems = dCore.mWanted
        .break nCoreItems == 0
      .fi
    .fi

    bTargetDead = dTarget.@dead
    .break bTargetDead

    .int bindOne
    .break @unit === null
    ucontrol boost true

    .int carrier
    .if carrier_bOk
      tryCarrier_bOk = true
      .break
    .fi
  .done
.fi
.reti tryCarrier


.label bindOne mUnit nThisFlag
.while
  .do
    bindOne_nFlag = @unit.@flag
    bindOne_uController = @unit.@controller
    .if bindOne_uController == @this
      .if bindOne_nFlag != nThisFlag
        .if bindOne_nFlag != 0
          ucontrol flag 0
          ucontrol unbind
        .fi
        .break
      .fi
    .else
      bindOne_nControlled = @unit.@controlled
      .if bindOne_nControlled == @ctrlProcessor
        .break bindOne_nFlag != 0
      .fi

      ucontrol within 0 0 1 0
      bindOne_uController = @unit.@controller
      .break bindOne_uController != @this

      ucontrol flag nThisFlag
    .fi
    .reti bindOne
  .until

  ubind mUnit
.done


.label carrier @unit dTarget mWanted
carrier_bOk = false
carrier_mUnitItem = @unit.@firstItem
.if carrier_mUnitItem != mWanted
  # move to core
  ulocate building core false 0 carrier_xCore carrier_yCore carrier_bCoreFound dCore
  ucontrol approach carrier_xCore carrier_yCore 5

  # drop unwanted
  carrier_mUnitItem = @unit.@firstItem
  .if carrier_mUnitItem !== null
    .if carrier_mUnitItem != mWanted
      ucontrol itemDrop dCore 999
    .fi
  .fi

  # take all
  ucontrol itemTake dCore mWanted 999
  carrier_tTakeItem = @time
.else
  # drop to target
  carrier_xTarget = dTarget.@x
  carrier_yTarget = dTarget.@y
  ucontrol approach carrier_xTarget carrier_yTarget 5
  ucontrol itemDrop dTarget 999

  # test drop
  carrier_tDuration = @time - carrier_tTakeItem
  .if carrier_tDuration >= 1500
    ucontrol within carrier_xTarget carrier_yTarget 6 carrier_bOk
  .fi
.fi
.reti carrier`)
})
