## MinAsm

**Try it!**
* Compiler: https://yangfl.github.io/minasm/
* image2logic: https://yangfl.github.io/minasm/image2logic.html

Assembly-like language that compiled to [Mindustry Logic Language](https://mindustrygame.github.io/wiki/logic/0-introduction/), inspired by https://pypi.org/project/MindustryCompiler/.

#### features:

* superset of Mindustry Logic Language, any Logic code is valid here!
* line-based macro language
* control flow
* comments
* easy-to-understand compiler

| You write.. | It translates... |
|--|--|
| `a = 1` | `set a 1` |
| `a += 1` | `op add a a 1` |
| `a = b * c` | `op mul a b c` |
| `a = b.c` | `sensor a b c` |
| `a = %c` | `getlink a c` |
| `a = cell1[0]` | `read a cell1 0` |
| `cell1[0] = a` | `write a cell1 0` |
| `ucontrol boost 1` | `ucontrol boost 1 0 0 0 0` |
| `jump 0` | `jump 0 always x false` |
| `end 1 < 1` | `jump 0 lessThan 1 1` |
| <code>.if a == 1<br />&nbsp;&nbsp;...<br />.elif a == 1<br />&nbsp;&nbsp;...<br />.else<br />&nbsp;&nbsp;...<br />.fi</code> | <code>0: jump 3 notEqual a 1  # .if a == 1<br />1: &nbsp;&nbsp;...<br />2: jump 7 always x false<br />3: jump 6 notEqual a 1  # .elif a == 1<br />4: &nbsp;&nbsp;...<br />5: jump 7 always x false  # .else<br />6: &nbsp;&nbsp;...</code> |
| <code>.label start<br />...<br />...<br />jump start a != 1</code> | <code>0: ...<br />1: ...<br />2: jump 0 notEqual a 1</code>
| <code>.while a == 1<br />&nbsp;&nbsp;...<br />&nbsp;&nbsp;.break b == 1  # can be conditional!<br />&nbsp;&nbsp;.continue c == 1<br />&nbsp;&nbsp;...<br />.end</code> | <code>0: jump 6 notEqual a 1  # .while a == 1<br />1: &nbsp;&nbsp;...<br />2: &nbsp;&nbsp;jump 6 equal b 1  # .break b == 1  // can be conditional!<br />3: &nbsp;&nbsp;jump 0 equal c 1  # .continue c == 1<br />4: &nbsp;&nbsp;...<br />5: jump 0 always x false  # .end</code>
| <code>.do<br />&nbsp;&nbsp;...<br />.when a == 1  # also until available</code> | <code>0: &nbsp;&nbsp;...<br />1: jump 0 equal a 1  # .when a == 1  // also until available</code>
| <code>.do<br />&nbsp;&nbsp;...<br />.until  # ignore condition equals True, but generate better code</code> | <code>0:   ...</code>
