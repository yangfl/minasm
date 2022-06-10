'use strict'

/********** utilities **********/

/**
 * @param {Blob} blob
 * @returns {Promise<FileReader>}
 */
function readFile (blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = function (event) {
      resolve(event.target)
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}


/**
 * @param {HTMLInputElement} input
 * @returns {Promise<FileReader>}
 */
function readInputFile (input) {
  return input.files.length === 0 ? null : readFile(input.files[0])
}


/**
 * @param {string} url Data URL.
 * @returns {Promise<HTMLImageElement>}
 */
function dataURL2Image (url) {
  return new Promise((resolve, reject) => {
    const image = new Image
    image.onload = function (event) {
      resolve(event.target)
    }
    image.onerror = reject
    image.src = url
  })
}


/********** k-means **********/

/**
 * @template T
 * @callback Metric
 * @param {T} a
 * @param {T} [b]
 * @returns {number}
 */


/**
 * @type {Metric<number[]>}
 */
function euclidean (a, b = null) {
  if (a === b) {
    return 0
  }
  const dim = !b ? a.length : Math.max(a.length, b.length)
  let distance = 0
  for (let i = 0; i < dim; i++) {
    distance += (!b ? a[i] : (a[i] || 0) - (b[i] || 0)) ** 2
  }
  return Math.sqrt(distance)
}


/**
 * @type {Metric<number[]>}
 */
function manhattan (a, b = null) {
  if (a === b) {
    return 0
  }
  const dim = !b ? a.length : Math.max(a.length, b.length)
  let distance = 0
  for (let i = 0; i < dim; i++) {
    distance += Math.abs(!b ? a[i] : (a[i] || 0) - (b[i] || 0))
  }
  return distance
}


/**
 * @template T
 * @callback Grouper
 * @param {T[]} data
 * @param {number} K
 * @param {number[]} tags
 * @returns {[(?T)[], number[]]}
 */


/**
 * @type {Grouper<number[]>}
 */
function euclideanGroup (data, K, tags) {
  /** @type {(?number[])[]} */
  const centroids = new Array(K).fill(null)
  /** @type {number[]} */
  const counts = new Array(K).fill(0)

  for (let i = 0; i < data.length; i++) {
    const datum = data[i]
    const k = tags[i]
    counts[k]++
    if (centroids[k] === null) {
      centroids[k] = new Array(datum.length).fill(0)
    } else {
      while (centroids[k].length < datum.length) {
        centroids[k].push(0)
      }
    }
    for (let d = 0; d < datum.length; d++) {
      centroids[k][d] += datum[d]
    }
  }

  for (let k = 0; k < K; k++) {
    if (counts[k] > 1) {
      for (let d = 0; d < centroids[k].length; d++) {
        centroids[k][d] /= counts[k]
      }
    }
  }
  return [centroids, counts]
}


/**
 * @template T
 * @param {T[]} data
 * @param {number} K
 * @param {number} stderror
 * @param {Metric<T>} metric
 * @param {Grouper<T>} grouper
 * @returns {[T[], number[], number[]]}
 */
function kmeans (
    data, K, stderror = 1e-6, metric = euclidean, grouper = euclideanGroup) {
  const variance = stderror ** 2

  /** @type {number[]} */
  const tags = new Array(data.length).fill(0)
  /** @type {number[]} */
  const tagsDistance = new Array(data.length).fill(0)
  /** @type {(?T)[]} */
  const centroids = new Array(K).fill(null)
  /** @type {number[][]} */
  const centroidsDistances = new Array(K)
  for (let k = 0; k < K; k++) {
    centroidsDistances[k] = new Array(K).fill(Infinity)
    centroidsDistances[k][k] = 0
  }
  /** @type {number[]} */
  const centroidsVar = new Array(K).fill(0)

  while (true) {
    let changed = false

    // update centroids
    const [newCentroids, counts] = grouper(data, K, tags)
    /** @type {boolean[]} */
    const centroidsChanged = new Array(K)
    for (let k = 0; k < K; k++) {
      centroidsChanged[k] = newCentroids[k] === null ?
        centroids[k] !== null :
        centroids[k] === null || metric(centroids[k], newCentroids[k]) !== 0
    }
    for (let k = 0; k < K; k++) {
      centroids[k] = newCentroids[k]
    }

    // update centroids distances
    for (let k = 1; k < K; k++) {
      for (let k_ = 0; k_ < k; k_++) {
        if (centroidsChanged[k_] || centroidsChanged[k]) {
          const hasInvalid = centroids[k_] === null || centroids[k] === null
          const centroidDistance =
            hasInvalid ? Infinity : metric(centroids[k_], centroids[k])
          if (hasInvalid || centroidDistance * 2 > stderror) {
            centroidsDistances[k_][k] = centroidDistance
            centroidsDistances[k][k_] = centroidDistance
          } else {
            changed = true
            centroids[k_] = null
            centroidsChanged[k_] = true
            for (let k = 0; k < K; k++) {
              if (k !== k_) {
                centroidsDistances[k_][k] = Infinity
                centroidsDistances[k][k_] = Infinity
              }
            }
            for (let i = 0; i < data.length; i++) {
              if (tags[i] === k_) {
                tags[i] = k
                if (!centroidsChanged[k]) {
                  tagsDistance[i] = metric(centroids[k], data[i])
                }
              }
            }
          }
        }
      }
    }

    // update variances
    for (let i = 0; i < data.length; i++) {
      if (centroidsChanged[tags[i]]) {
        tagsDistance[i] = metric(centroids[tags[i]], data[i])
      }
    }
    centroidsVar.fill(0)
    for (let i = 0; i < data.length; i++) {
      centroidsVar[tags[i]] += tagsDistance[i] ** 2
    }
    for (let k = 0; k < K; k++) {
      if (counts[k] > 1) {
        centroidsVar[k] /= counts[k] - 1
      }
    }
    if (!changed && centroidsVar.every(v => v < variance)) {
      break
    }

    // split group
    const dest = counts.indexOf(0)
    if (dest >= 0) {
      changed = true
      const src = centroidsVar.reduce(
        (max, x, i, arr) => x > arr[max] ? i : max, 0)
      const i = data.reduce(
        (max, x, i) =>
          tags[i] === src && tagsDistance[i] > tagsDistance[max] ? i : max,
        tags.indexOf(src))
      tags[i] = dest
      tagsDistance[i] = 0
      centroids[dest] = data[i]
      for (let k = 0; k < K; k++) {
        if (k === dest || centroids[k] === null) {
          continue
        }
        const centroidDistance = metric(centroids[dest], centroids[k])
        centroidsDistances[dest][k] = centroidDistance
        centroidsDistances[k][dest] = centroidDistance
      }
    }

    // update tags
    for (let i = 0; i < data.length; i++) {
      for (let k = 0; k < K; k++) {
        if (centroids[k] === null) {
          continue
        }
        if (tagsDistance[i] * 2 <= centroidsDistances[tags[i]][k]) {
          continue
        }
        const distance = metric(centroids[k], data[i])
        if (distance < tagsDistance[i]) {
          changed = true
          tags[i] = k
          tagsDistance[i] = distance
        }
      }
    }
    if (!changed && centroids.every(centroid => centroid !== null)) {
      break
    }
  }

  /** @type {number[]} */
  const tagMap = new Array(K)
  let tagCount = 0
  for (let k = 0; k < K; k++) {
    if (centroids[k] !== null) {
      tagMap[k] = tagCount
      tagCount++
    }
  }

  return tagCount === centroids.length ?
    [centroids, tags, tagsDistance] :
    [centroids.filter(x => x !== null), tags.map(x => tagMap[x]), tagsDistance]
}


/**
 * @template T
 * @param {T[]} matrix
 * @param {number} width
 * @param {number} height
 * @param {number} blur
 * @returns {T[]}
 */
function matrixBlur (matrix, width, height, blur = 0) {
  const matrixBlurred = matrix.slice()
  if (blur === 0) {
    return matrixBlurred
  }

  for (let hc = 0; hc < height; hc++) {
    for (let wc = 0; wc < width; wc++) {
      /** @type {Map<number, number>} */
      const counter = new Map
      let size = 0
      for (let dh = -blur; dh <= blur; dh++) {
        for (let dw = -blur; dw <= blur; dw++) {
          const w = wc + dw
          if (w < 0 || w >= width) {
            continue
          }
          const h = hc + dh
          if (h < 0 || h >= height) {
            continue
          }
          size++
          const i = width * h + w
          counter.set(matrix[i], (counter.get(matrix[i]) || 0) + 1)
        }
      }
      const ic = width * hc + wc
      let maxCount = size / 2
      for (const [tag, count] of counter) {
        if (count > maxCount) {
          maxCount = count
          matrixBlurred[ic] = tag
        }
      }
    }
  }
  return matrixBlurred
}


/********** orthogonalization **********/

/**
 * rect
 */
class Rectangle {
  /**
   * @param {number} l
   * @param {number} t
   * @param {number} r
   * @param {number} b
   */
  constructor (l, t, r, b) {
    /** @type {number} */
    this.l = l
    /** @type {number} */
    this.t = t
    /** @type {number} */
    this.r = r
    /** @type {number} */
    this.b = b
  }
}


class TaggedRectangle extends Rectangle {
  /**
   * @param {number} l
   * @param {number} t
   * @param {number} r
   * @param {number} b
   * @param {number} tag
   */
  constructor (l, t, r, b, tag) {
    super(l, t, r, b)
    /** @type {number} */
    this.tag = tag

    /** @type {number} */
    this.level = 0
    /** @type {Set<TaggedRectangle>} */
    this.covered = new Set
  }

  /**
   * @param {TaggedRectangle} rect
   */
  cover (rect) {
    if (rect) {
      this.covered.add(rect)
    }
  }

  /**
   * @param {ReadonlySet<TaggedRectangle>} visibles
   */
  filter (visibles) {
    for (const rect of this.covered) {
      if (!visibles.has(rect)) {
        this.covered.delete(rect)
      }
    }
  }

  sort () {
    if (this.covered.size !== 0 && this.level === 0) {
      for (const rect of this.covered) {
        const level = rect.sort()
        if (level >= this.level) {
          this.level = level + 1
        }
      }
    }
    return this.level
  }

  /**
   * @param {number} direction
   * @param {number[]} matrix
   * @param {number} width
   * @param {number} left
   * @param {number} top
   * @param {number} right
   * @param {number} bottom
   * @returns {boolean}
   */
  atCorner (direction, matrix, width, left, top, right, bottom) {
    switch (direction) {
      case 0:
        const tl = width * this.t + this.l
        if (matrix[tl] !== this.tag) {
          return false
        }
        if (this.l <= left && this.t <= top) {
          return true
        }
        if (this.l > left && matrix[tl - 1] === this.tag) {
          return false
        }
        if (this.t > top && matrix[tl - width] === this.tag) {
          return false
        }
        return true
      case 1:
        const tr = width * this.t + (this.r - 1)
        if (matrix[tr] !== this.tag) {
          return false
        }
        if (this.r >= right && this.t <= top) {
          return true
        }
        if (this.r < right && matrix[tr + 1] === this.tag) {
          return false
        }
        if (this.t > top && matrix[tr - width] === this.tag) {
          return false
        }
        return true
      case 2:
        const bl = width * (this.b - 1) + this.l
        if (matrix[bl] !== this.tag) {
          return false
        }
        if (this.l <= left && this.b >= bottom) {
          return true
        }
        if (this.l > left && matrix[bl - 1] === this.tag) {
          return false
        }
        if (this.b < bottom && matrix[bl + width] === this.tag) {
          return false
        }
        return true
      case 3:
        const br = width * (this.b - 1) + (this.r - 1)
        if (matrix[br] !== this.tag) {
          return false
        }
        if (this.r >= right && this.b >= bottom) {
          return true
        }
        if (this.r < right && matrix[br + 1] === this.tag) {
          return false
        }
        if (this.b < bottom && matrix[br + width] === this.tag) {
          return false
        }
        return true
    }
    return false
  }
}


/**
 * @callback Orthogonalizer
 * @param {number[]} matrix
 * @param {number} matrixWidth
 * @param {number} matrixHeight
 * @param {number} [matrixLeft]
 * @param {number} [matrixTop]
 * @param {number} [matrixRight]
 * @param {number} [matrixBottom]
 * @param {any} [options]
 * @returns {[TaggedRectangle[], number[]]}
 */


/**
 * @type {Orthogonalizer}
 */
function matrix2rectsNonOverlapped (
    matrix, matrixWidth, matrixHeight,
    matrixLeft = 0, matrixTop = 0, matrixRight = -1, matrixBottom = -1,
    options = null) {
  const matrixRight_ = matrixRight >= 0 ? matrixRight : matrixWidth
  const matrixBottom_ = matrixBottom >= 0 ? matrixBottom : matrixHeight
  if (matrixLeft >= matrixRight_ || matrixTop >= matrixBottom_) {
    return []
  }

  const width = matrixRight_ - matrixLeft
  const height = matrixBottom_ - matrixTop
  const area = width * height

  /** @type {number[]} */
  const canvas = new Array(area)
  /** @type {TaggedRectangle[]} */
  const rects = []

  for (let t = 0; t < height; t++) {
    for (let l = 0; l < width; l++) {
      const matrixTl = matrixWidth * (t + matrixTop) + (l + matrixLeft)
      const tl = width * t + l
      if (matrix[matrixTl] === canvas[tl]) {
        continue
      }
      const tag = matrix[matrixTl]

      let found = false
      let r = l
      let b = t
      for (let b_ = t; b_ < height && !found; b_++) {
        for (let r_ = l; r_ < width; r_++) {
          const matrixB_r_ = matrixWidth * (b_ + matrixTop) + (r_ + matrixLeft)
          if (matrix[matrixB_r_] !== tag) {
            break
          }
          r = r_
          b = b_
          const b_r_ = width * b_ + r_
          found ||= canvas[b_r_] !== tag
        }
      }
      r++

      for (let b_ = b + 1; b_ < height; b_++) {
        let every = true
        for (let r_ = l; r_ < r; r_++) {
          const matrixB_r_ = matrixWidth * (b_ + matrixTop) + (r_ + matrixLeft)
          if (matrix[matrixB_r_] !== tag) {
            every = false
            break
          }
        }
        if (!every) {
          break
        }
        b = b_
      }
      b++

      rects.push(new TaggedRectangle(
        l + matrixLeft, t + matrixTop, r + matrixLeft, b + matrixTop, tag))

      for (let h = t; h < b; h++) {
        for (let w = l; w < r; w++) {
          const i = width * h + w
          canvas[i] = tag
        }
      }
    }
  }

  rects.sort((a, b) => a.tag - b.tag)
  return [rects, matrix.slice()]
}


/**
 * @type {Orthogonalizer}
 */
function matrix2rectsOverlapped (
    matrix, matrixWidth, matrixHeight,
    matrixLeft = 0, matrixTop = 0, matrixRight = -1, matrixBottom = -1,
    options = null) {
  const matrixRight_ = matrixRight >= 0 ? matrixRight : matrixWidth
  const matrixBottom_ = matrixBottom >= 0 ? matrixBottom : matrixHeight
  if (matrixLeft >= matrixRight_ || matrixTop >= matrixBottom_) {
    return []
  }

  const width = matrixRight_ - matrixLeft
  const height = matrixBottom_ - matrixTop
  const area = width * height

  /** @type {number[]} */
  const canvas = new Array(area)
  /** @type {number[]} */
  const real = new Array(matrix.length).fill(-1)
  /** @type {TaggedRectangle[]} */
  const rects = new Array(area).fill(null)
  /** @type {boolean[]} */
  const pins = new Array(area).fill(false)

  let count = 0
  for (let changed = true; changed; ) {
    changed = false

    for (let t = 0; t < height; t++) {
      for (let l = 0; l < width; l++) {
        const matrixTl = matrixWidth * (t + matrixTop) + (l + matrixLeft)
        const tl = width * t + l
        if (matrix[matrixTl] === canvas[tl]) {
          continue
        }
        changed = true
        const tag = matrix[matrixTl]

        let r = l
        for (let r_ = l + 1; r_ < width; r_++) {
          const tr_ = width * t + r_
          if (pins[tr_]) {
            break
          }
          const matrixTr_ = matrixWidth * (t + matrixTop) + (r_ + matrixLeft)
          if (matrix[matrixTr_] === tag && canvas[tr_] !== tag) {
            r = r_
          }
        }
        let b = t
        for (let b_ = t + 1; b_ < height; b_++) {
          let pinned = false
          for (let w = l; w <= r; w++) {
            if (pins[width * b_ + w]) {
              pinned = true
              break
            }
          }
          if (pinned) {
            break
          }
          const matrixB_r = matrixWidth * (b_ + matrixTop) + (r + matrixLeft)
          const b_r = width * b_ + r
          if (matrix[matrixB_r] === tag && canvas[b_r] !== tag) {
            b = b_
          }
        }

        r++
        b++

        if (options && options.noise &&
            r - l <= options.noise && b - t <= options.noise) {
          for (let h = t; h < b; h++) {
            for (let w = l; w < r; w++) {
              const i = width * h + w
              canvas[i] = tag
            }
          }
        } else {
          const rect = new TaggedRectangle(
            l + matrixLeft, t + matrixTop, r + matrixLeft, b + matrixTop, tag)
          count++
          if (count > 99999) {
            throw new Error('too many rects')
          }

          if (rect.atCorner(1, matrix, matrixWidth,
                            matrixLeft, matrixTop, matrixRight, matrixBottom)) {
            pins[width * t + (r - 1)] = true
          }
          if (rect.atCorner(2, matrix, matrixWidth,
                            matrixLeft, matrixTop, matrixRight, matrixBottom)) {
            pins[width * (b - 1) + l] = true
          }
          if (rect.atCorner(3, matrix, matrixWidth,
                            matrixLeft, matrixTop, matrixRight, matrixBottom)) {
            pins[width * (b - 1) + (r - 1)] = true
          }

          for (let h = t; h < b; h++) {
            for (let w = l; w < r; w++) {
              const i = width * h + w
              canvas[i] = tag
              rect.cover(rects[i])
              rects[i] = rect

              const matrixI = matrixWidth * (h + matrixTop) + (w + matrixLeft)
              real[matrixI] = tag
            }
          }
        }
      }
    }
  }

  /** @type {Set<TaggedRectangle>} */
  const visibles = new Set
  for (let i = 0; i < rects.length; i++) {
    if (rects[i]) {
      visibles.add(rects[i])
    }
  }
  for (const rect of visibles) {
    rect.filter(visibles)
  }

  let levels = 0
  for (const rect of visibles) {
    const level = rect.sort()
    if (level > levels) {
      levels = level
    }
  }
  levels++

  /** @type {TaggedRectangle[][]} */
  const bulks = new Array(levels)
  for (let level = 0; level < bulks.length; level++) {
    bulks[level] = []
  }
  for (const rect of visibles) {
    bulks[rect.level].push(rect)
  }

  /** @type {TaggedRectangle[]} */
  const result = []
  for (let level = 0; level < bulks.length; level++) {
    result.push(...bulks[level].sort(
      level & 1 === 0 ? (a, b) => b.tag - a.tag : (a, b) => a.tag - b.tag))
  }
  return [result, real]
}


/********** codegen **********/

/**
 * @param {TaggedRectangle} rect
 * @param {number} displayHeight
 * @returns {string}
 */
function rect2cmd (rect, displayHeight) {
  return `draw rect ${rect.l} ${displayHeight - rect.b} ${rect.r - rect.l} ${rect.b - rect.t}`
}


const flushThreshold = 256


/**
 * @param {TaggedRectangle[]} rects
 * @returns {number}
 */
function rects2cmdCount (rects) {
  let count = 0
  let tagPrev = -1
  for (let i = 0; i < rects.length; i++) {
    const {tag} = rects[i]
    if (tag !== tagPrev) {
      tagPrev = tag
      count++
    }
    count++
  }
  return count + Math.ceil(count / flushThreshold)
}


/**
 * @param {TaggedRectangle[]} rects
 * @param {string[]} colorsDraw
 * @param {number} displayHeight
 * @param {string} displayName
 * @param {number} cmdCount
 * @returns {string[]}
 * @throws {Error}
 */
function rects2cmds (
    rects, colorsDraw, displayHeight, displayName, cmdCount = -1) {
  const drawflush = 'drawflush ' + displayName

  let count = 0
  /** @type {string[]} */
  const cmds = []
  let tagPrev = -1
  for (let i = 0; i < rects.length; i++) {
    const tag = rects[i].tag
    if (tag !== tagPrev) {
      tagPrev = tag
      cmds.push(colorsDraw[tag])
      count++
      if (count % flushThreshold === 0) {
        cmds.push(drawflush)
      }
    }
    cmds.push(rect2cmd(rects[i], displayHeight))
    count++
    if (count % flushThreshold === 0) {
      cmds.push(drawflush)
    }
  }
  if (count % flushThreshold !== 0) {
    cmds.push(drawflush)
  }

  if (cmdCount >= 0 && cmds.length !== cmdCount) {
    debugger
    throw new Error('Internal error')
  }
  return cmds
}


/**
 * @param {string[][]} cmdsArr
 * @param {TaggedRectangle[]} rects
 * @param {string[]} colorsDraw
 * @param {number} displayHeight
 * @param {string} displayName
 * @param {number} cmdCount
 * @param {boolean} force
 */
function cmdsArrAddRects (
    cmdsArr, rects, colorsDraw, displayHeight, displayName, cmdCount = -1,
    force = false) {
  for (let i = 0; i < cmdsArr.length; i++) {
    const cmdCountNew = cmdsArr[i].length + cmdCount
    if (cmdCountNew <= 999 && (force || cmdCountNew >= 990)) {
      cmdsArr[i].push(...rects2cmds(
        rects, colorsDraw, displayHeight, displayName, cmdCount))
      return true
    }
  }

  if (force) {
    cmdsArr.push(rects2cmds(
      rects, colorsDraw, displayHeight, displayName, cmdCount))
  }
  return force
}


/**
 * @callback Plotter
 * @param {number[]} matrix
 * @param {number} matrixWidth
 * @param {number} matrixHeight
 * @param {Orthogonalizer} orthogonalizer
 * @param {string[]} colorsDraw
 * @param {number} displayHeight
 * @param {string} displayName
 * @param {any} [options]
 * @returns {[string[][], number[]]}
 */


/**
 * @type {Plotter}
 */
function matrix2cmdsArrUnbarriered (
    matrix, matrixWidth, matrixHeight, orthogonalizer,
    colorsDraw, displayHeight, displayName, options = null) {
  const [rects, real] = orthogonalizer(
    matrix, matrixWidth, matrixHeight, 0, 0, -1, -1, options)
  const drawflush = 'drawflush ' + displayName
  /** @type {string[][]} */
  const cmdsArr = [[]]

  let count = 0
  let tagPrev = -1
  for (let i = 0; i < rects.length; i++) {
    const tag = rects[i].tag
    if (tag !== tagPrev) {
      tagPrev = tag
      if (cmdsArr[cmdsArr.length - 1].length > 999 - 3) {
        cmdsArr[cmdsArr.length - 1].push(drawflush)
        cmdsArr.push([colorsDraw[tag]])
        count = 1
      } else {
        cmdsArr[cmdsArr.length - 1].push(colorsDraw[tag])
        count++
        if (count % flushThreshold === 0) {
          cmdsArr[cmdsArr.length - 1].push(drawflush)
        }
      }
    }

    if (cmdsArr[cmdsArr.length - 1].length > 999 - 2) {
      cmdsArr[cmdsArr.length - 1].push(drawflush)
      cmdsArr.push([colorsDraw[tag]])
      count = 1
    }
    cmdsArr[cmdsArr.length - 1].push(rect2cmd(rects[i], displayHeight))
    count++
    if (count % flushThreshold === 0) {
      cmdsArr[cmdsArr.length - 1].push(drawflush)
    }
  }
  if (count % flushThreshold !== 0) {
    cmdsArr[cmdsArr.length - 1].push(drawflush)
  }

  return [cmdsArr, real]
}


/**
 * @type {Plotter}
 */
function matrix2cmdsArrBarriered (
    matrix, matrixWidth, matrixHeight, orthogonalizer,
    colorsDraw, displayHeight, displayName, options = null) {
  /** @type {string[][]} */
  const cmdsArr = []
  /** @type {number[]} */
  const real = new Array(matrix.length).fill(-1)
  /** @type {[number, number, TaggedRectangle[], number[]][]} */
  const prevs = []

  for (let top = 0, bottom = 1; top < matrixHeight; bottom++) {
    const [rects, realRects] = orthogonalizer(
      matrix, matrixWidth, matrixHeight, 0, top, -1, bottom, options)
    const cmdCount = rects2cmdCount(rects)

    if (cmdCount <= flushThreshold + 1 || bottom - top === 1) {
      if (bottom - top > 1) {
        while (prevs.length > 0 &&
               cmdCount <= prevs[prevs.length - 1][1]) {
          prevs.pop()
        }
      } else if (cmdCount > flushThreshold + 1) {
        console.warn(top, cmdCount)
      }
      prevs.push([bottom, cmdCount, rects, realRects])
    }

    if (cmdCount > flushThreshold + 1 || bottom >= matrixHeight) {
      /** @type {?number[]} */
      let realRects = null
      for (let i = prevs.length - 1; i >= 0; i--) {
        if (cmdsArrAddRects(cmdsArr, prevs[i][2], colorsDraw, displayHeight,
                            displayName, prevs[i][1])) {
          bottom = prevs[i][0]
          realRects = prevs[i][3]
          break
        }
      }
      if (realRects === null) {
        const last = prevs[prevs.length - 1]
        if (!cmdsArrAddRects(cmdsArr, last[2], colorsDraw, displayHeight,
                             displayName, last[1], true)) {
          cmdsArr.push(rects2cmds(
            last[2], colorsDraw, displayHeight, displayName, last[1]))
        }
        bottom = last[0]
        realRects = last[3]
      }

      for (let h = top; h < bottom; h++) {
        for (let w = 0; w < matrixWidth; w++) {
          if (realRects[matrixWidth * h + w] === undefined) debugger
          real[matrixWidth * h + w] = realRects[matrixWidth * h + w]
        }
      }

      top = bottom
      prevs.length = 0
    }
  }

  return [cmdsArr, real]
}


/********** main **********/

/**
 * @typedef Color
 * @type {[number, number, number]}
 */

/** @type {HTMLFormElement} */
const form = document.getElementById('image2logic')

const savedKeys = ['width', 'height', 'blur', 'noise', 'K', 'display-name']
for (const key of savedKeys) {
  const value = localStorage.getItem('image2logic::' + key)
  if (value !== null) {
    form.elements[key].value = value
  }
}

/**
 * @param {HTMLFormElement} form
 */
function applySettings (form) {
  const canvasWidth = parseInt(form.elements['width'].value) || 80
  const canvasHeight = parseInt(form.elements['height'].value) || 80
  /** @type {HTMLCanvasElement} */
  const canvasRaw = form.getElementsByClassName('image2logic--raw')[0]
  if (canvasRaw.width != canvasWidth) {
    canvasRaw.width = canvasWidth
  }
  if (canvasRaw.height != canvasHeight) {
    canvasRaw.height = canvasHeight
  }
  /** @type {HTMLCanvasElement} */
  const canvas = form.getElementsByClassName('image2logic--canvas')[0]
  if (canvas.width != canvasWidth) {
    canvas.width = canvasWidth
  }
  if (canvas.height != canvasHeight) {
    canvas.height = canvasHeight
  }
}

applySettings(form)

form.addEventListener('change', async function (event) {
  // save keys
  /** @type {HTMLInputElement} */
  const target = event.target
  if (savedKeys.includes(target.name)) {
    localStorage.setItem('image2logic::' + target.name, target.value)
  }

  /** @type {HTMLFormElement} */
  const form = target.form
  applySettings(form)

  // read image
  /** @type {FileReader} */
  let reader = null
  try {
    reader = await readInputFile(form.elements['image'])
  } catch (e) { }
  if (!reader) {
    return
  }
  const image = await dataURL2Image(reader.result)
  /** @type {HTMLSpanElement} */
  const spanOriginalSize =
    form.getElementsByClassName('image2logic--original-size')[0]
  spanOriginalSize.textContent = image.width + ' x ' + image.height

  // draw raw image
  /** @type {HTMLCanvasElement} */
  const canvasRaw = form.getElementsByClassName('image2logic--raw')[0]
  const scale = Math.max(
    1, image.width / canvasRaw.width, image.height / canvasRaw.height)
  /** @type {HTMLSpanElement} */
  const spanScale = form.getElementsByClassName('image2logic--scale')[0]
  spanScale.textContent = scale
  const imageWidthScaled = image.width / scale
  const imageHeightScaled = image.height / scale
  /** @type {HTMLSpanElement} */
  const spanImageSize =
    form.getElementsByClassName('image2logic--image-size')[0]
  spanImageSize.textContent = imageWidthScaled + ' x ' + imageHeightScaled
  const ctxRaw = canvasRaw.getContext('2d')
  ctxRaw.fillStyle = 'white'
  ctxRaw.fillRect(0, 0, canvasRaw.width, canvasRaw.height)
  // CHROME BUG
  ctxRaw.getImageData(0, 0, 1, 1)
  ctxRaw.drawImage(image, 0, 0, imageWidthScaled, imageHeightScaled)

  // extract canvas
  const imageData =
    ctxRaw.getImageData(0, 0, imageWidthScaled, imageHeightScaled)
  /** @type {Color[]} */
  const pixelsLabRaw = []
  for (let i = 0; i < imageData.data.length; i += 4) {
    const color = d3.lab(d3.rgb(
      imageData.data[i], imageData.data[i + 1], imageData.data[i + 2]))
    pixelsLabRaw.push([color.l, color.a, color.b])
  }

  // compress
  const K = parseInt(form.elements['K'].value) || 20
  const [colorsLab, tagsRaw, tagsDistance] = kmeans(pixelsLabRaw, K, 2.3 * 1.5)
  /** @type {HTMLSpanElement} */
  const spanGroupsNumber =
    form.getElementsByClassName('image2logic--group-number')[0]
  spanGroupsNumber.textContent = colorsLab.length
  /** @type {HTMLSpanElement} */
  const spanLoss = form.getElementsByClassName('image2logic--loss')[0]
  spanLoss.textContent = Math.sqrt(
    tagsDistance.reduce((acc, v) => acc + v ** 2, 0) / tagsDistance.length)
  /** @type {Color[]} */
  const colorsRgb = new Array(colorsLab.length)
  for (let i = 0; i < colorsLab.length; i++) {
    const color = d3.lab(...colorsLab[i]).rgb().clamp()
    colorsRgb[i] = [color.r, color.g, color.b]
  }
  const tags = matrixBlur(tagsRaw, imageData.width, imageData.height,
                          parseInt(form.elements['blur'].value) || 0)

  // convert to commands
  /** @type {Plotter} */
  let plotter
  /** @type {Orthogonalizer} */
  let orthogonalizer
  switch (form.elements['backend'].value) {
    case 'nonoverlapped':
      plotter = matrix2cmdsArrUnbarriered
      orthogonalizer = matrix2rectsNonOverlapped
      break
    default:
      plotter = matrix2cmdsArrBarriered
      orthogonalizer = matrix2rectsOverlapped
      break
  }
  /** @type {HTMLCanvasElement} */
  const canvas = form.getElementsByClassName('image2logic--canvas')[0]
  const [cmdsArr, tagsReal] = plotter(
    tags, imageData.width, imageData.height, orthogonalizer,
    colorsRgb.map(color => 'draw color ' + color.join(' ') + ' 255'),
    canvas.height, form.elements['display-name'].value || 'display1', {
      noise: parseInt(form.elements['noise'].value) || 0
    })
  /** @type {HTMLSpanElement} */
  const spanCommandsNumber =
    form.getElementsByClassName('image2logic--command-numbers')[0]
  spanCommandsNumber.textContent = cmdsArr.map(cmds => cmds.length).join(', ')
  /** @type {HTMLTextAreaElement} */
  const output = form.elements['output']
  output.value = ''
  /** @type {HTMLElement} */
  const elmCopyers = form.getElementsByClassName('image2logic--copyers')[0]
  elmCopyers.textContent = ''
  for (let i = 0; i < cmdsArr.length; i++) {
    const cmds = cmdsArr[i]
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = `Copy ${i + 1}`
    button.addEventListener('click', function (event) {
      /** @type {HTMLButtonElement} */
      const target = event.target
      target.style.color = 'red'

      const buttons = target.parentElement.children
      for (let i = 0; i < buttons.length; i++) {
        const button = buttons[i]
        if (button === target) {
          continue
        }
        if (button.style.color) {
          button.style.color = 'gray'
        }
      }

      /** @type {HTMLTextAreaElement} */
      const output = target.form.elements['output']
      output.value = cmds.join('\n')
      output.select()
      document.execCommand('copy')
    })
    elmCopyers.appendChild(button)
  }

  // draw compressed image
  /** @type {Color} */
  const colorBG = [86, 86, 102]
  for (let i = 0; i < tagsReal.length; i++) {
    const color = tagsReal[i] < 0 ? colorBG : colorsRgb[tagsReal[i]]
    imageData.data[i * 4] = color[0]
    imageData.data[i * 4 + 1] = color[1]
    imageData.data[i * 4 + 2] = color[2]
  }
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = 'white'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.putImageData(imageData, 0, 0)
})
