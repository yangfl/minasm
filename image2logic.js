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


/********** preprocessor **********/

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


/**
 * @param {number[]} matrix
 * @param {number} width
 * @param {number} height
 * @param {number} [left]
 * @param {number} [top]
 * @param {number} [right]
 * @param {number} [bottom]
 * @returns {number}
 */
function matrixBackground (
    matrix, width, height, left = 0, top = 0, right = -1, bottom = -1) {
  const right_ = right >= 0 ? right : width
  const bottom_ = bottom >= 0 ? bottom : height
  if (left >= right_ || top >= bottom_) {
    return 0
  }

  /** @type {number[]} */
  const tags = []

  for (let y = top; y < bottom_; y++) {
    for (let x = left; x < right_; x++) {
      const tag = matrix[width * y + x]
      while (tags.length <= tag) {
        tags.push(0)
      }
      tags[tag] += 1
    }
  }

  let background = 0
  let count = tags[0]
  for (let i = 1; i < tags.length; i++) {
    if (tags[i] > count) {
      background = i
      count = tags[i]
    }
  }

  return background
}


/********** k-means **********/

/**
 * @template T
 * @callback Metric metric function of two data points
 * @param {T} a data point
 * @param {T} [b] another data point, default to origin point of the coordinate system
 * @returns {number} metric
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
 * @callback Grouper function to update centroids using existing tags
 * @param {T[]} data input data points
 * @param {number} K number of groups
 * @param {number[]} tags tags for each data point
 * @returns {[(?T)[], number[]]} updated centroids, and number of points in each group
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
 * Divide data points into K clusters using k-means algorithm.
 * @template T data type
 * @param {T[]} data input data points
 * @param {number} K number of groups
 * @param {number} stderror desired standard error of every centroid
 * @param {Metric<T>} metric metric function of two data points
 * @param {Grouper<T>} grouper function to update centroids using existing tags
 * @returns {[T[], number[], number[]]} centroids, tags for each data point, and standard error of each centroid
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


/********** orthogonalization **********/

/**
 * Rectangle bounding box.
 */
class Rectangle {
  /**
   * start of x coordinate range (inclusive)
   * @type {number}
   */
  l
  /**
   * start of y coordinate range (inclusive)
   * @type {number}
   */
  t
  /**
   * end of x coordinate range (exclusive)
   * @type {number}
   */
  r
  /**
   * end of y coordinate range (exclusive)
   * @type {number}
   */
  b

  /**
   * @param {number} l
   * @param {number} t
   * @param {number} r
   * @param {number} b
   */
  constructor (l, t, r, b) {
    this.l = l
    this.t = t
    this.r = r
    this.b = b
  }

  /**
   * @param {Rectangle} other
   */
  compare (other) {
    return this.b - other.b || this.l - other.l ||
           this.t - other.t || this.r - other.r
  }
}


/**
 * Rectangle bounding box with tag.
 */
class TaggedRectangle extends Rectangle {
  /**
   * rectangle tag
   * @type {number}
   */
  tag

  /**
   * level of the rectangle in the rectangle heap
   * @type {number}
   */
  level = 0
  /**
   * rectangles covered by this rectangle
   * @type {Set<TaggedRectangle>}
   */
  covered = new Set

  /**
   * @param {number} l
   * @param {number} t
   * @param {number} r
   * @param {number} b
   * @param {number} tag
   */
  constructor (l, t, r, b, tag) {
    super(l, t, r, b)
    this.tag = tag
  }

  /**
   * @param {Rectangle} other
   */
  compare (other) {
    return this.tag - other.tag || super.compare(other)
  }

  /**
   * Indicate `rect` is covered by this rectangle.
   * @param {TaggedRectangle} rect The rectangle being covered.
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
 * @typedef OrthogonalizerOption
 * @property {number} [background] Background tag
 * @property {number} [noise] Image noise
 */

/**
 * @callback Orthogonalizer
 * @param {number[]} matrix
 * @param {number} width
 * @param {number} height
 * @param {number} [left]
 * @param {number} [top]
 * @param {number} [right]
 * @param {number} [bottom]
 * @param {OrthogonalizerOption} [options]
 * @returns {[TaggedRectangle[], number[]]}
 */


/**
 * @type {Orthogonalizer}
 */
function matrix2rectsGreedy (
    matrix, width, height, left = 0, top = 0, right = -1, bottom = -1,
    options = {}) {
  const right_ = right >= 0 ? right : width
  const bottom_ = bottom >= 0 ? bottom : height
  if (left >= right_ || top >= bottom_) {
    return []
  }

  const width_ = right_ - left
  const height_ = bottom_ - top
  const area = width_ * height_
  const background = 'background' in options ? options.background : -1

  /** @type {number[]} */
  const canvas = new Array(area).fill(background)
  /** @type {TaggedRectangle[]} */
  const rects = []

  for (let t = 0; t < height_; t++) {
    for (let l = 0; l < width_; l++) {
      const matrixTl = width * (t + top) + (l + left)
      const tl = width_ * t + l
      if (matrix[matrixTl] === canvas[tl]) {
        continue
      }
      const tag = matrix[matrixTl]

      let found = false
      let r = l
      let b = t
      for (let b_ = t; b_ < height_ && !found; b_++) {
        for (let r_ = l; r_ < width_; r_++) {
          const matrixB_r_ = width * (b_ + top) + (r_ + left)
          if (matrix[matrixB_r_] !== tag) {
            break
          }
          r = r_
          b = b_
          const b_r_ = width_ * b_ + r_
          found ||= canvas[b_r_] !== tag
        }
      }
      r++

      for (let b_ = b + 1; b_ < height_; b_++) {
        let every = true
        for (let r_ = l; r_ < r; r_++) {
          const matrixB_r_ = width * (b_ + top) + (r_ + left)
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
        l + left, t + top, r + left, b + top, tag))

      for (let h = t; h < b; h++) {
        for (let w = l; w < r; w++) {
          const i = width_ * h + w
          canvas[i] = tag
        }
      }
    }
  }

  rects.sort((a, b) => a.compare(b))
  return [rects, matrix.slice()]
}


/**
 * @type {Orthogonalizer}
 */
function matrix2rectsOverlapping (
    matrix, width, height, left = 0, top = 0, right = -1, bottom = -1,
    options = {}) {
  const right_ = right >= 0 ? right : width
  const bottom_ = bottom >= 0 ? bottom : height
  if (left >= right_ || top >= bottom_) {
    return []
  }

  const width_ = right_ - left
  const height_ = bottom_ - top
  const area = width_ * height_
  const background = 'background' in options ? options.background : -1

  /** @type {number[]} */
  const canvas = new Array(area).fill(background)
  /** @type {number[]} */
  const real = new Array(matrix.length).fill(background)
  /** @type {TaggedRectangle[]} */
  const rects = new Array(area).fill(null)
  /** @type {boolean[]} */
  const pins = new Array(area).fill(false)

  let count = 0
  for (let changed = true; changed; ) {
    changed = false

    for (let t = 0; t < height_; t++) {
      for (let l = 0; l < width_; l++) {
        const matrixTl = width * (t + top) + (l + left)
        const tl = width_ * t + l
        if (matrix[matrixTl] === canvas[tl]) {
          continue
        }
        changed = true
        const tag = matrix[matrixTl]

        let r = l
        for (let r_ = l + 1; r_ < width_; r_++) {
          const tr_ = width_ * t + r_
          if (pins[tr_]) {
            break
          }
          const matrixTr_ = width * (t + top) + (r_ + left)
          if (matrix[matrixTr_] === tag && canvas[tr_] !== tag) {
            r = r_
          }
        }
        let b = t
        for (let b_ = t + 1; b_ < height_; b_++) {
          let pinned = false
          for (let w = l; w <= r; w++) {
            if (pins[width_ * b_ + w]) {
              pinned = true
              break
            }
          }
          if (pinned) {
            break
          }
          const matrixB_r = width * (b_ + top) + (r + left)
          const b_r = width_ * b_ + r
          if (matrix[matrixB_r] === tag && canvas[b_r] !== tag) {
            b = b_
          }
        }

        r++
        b++

        if (options.noise && r - l <= options.noise && b - t <= options.noise) {
          for (let h = t; h < b; h++) {
            for (let w = l; w < r; w++) {
              const i = width_ * h + w
              canvas[i] = tag
            }
          }
        } else {
          const rect = new TaggedRectangle(
            l + left, t + top, r + left, b + top, tag)
          count++
          if (count > 99999) {
            throw new Error('too many rects')
          }

          if (rect.atCorner(1, matrix, width,
                            left, top, right, bottom)) {
            pins[width_ * t + (r - 1)] = true
          }
          if (rect.atCorner(2, matrix, width,
                            left, top, right, bottom)) {
            pins[width_ * (b - 1) + l] = true
          }
          if (rect.atCorner(3, matrix, width,
                            left, top, right, bottom)) {
            pins[width_ * (b - 1) + (r - 1)] = true
          }

          for (let h = t; h < b; h++) {
            for (let w = l; w < r; w++) {
              const i = width_ * h + w
              canvas[i] = tag
              rect.cover(rects[i])
              rects[i] = rect

              const matrixI = width * (h + top) + (w + left)
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
      (a, b) => level & 1 === 0 ? -a.compare(b) : a.compare(b)))
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


/**
 * @param {Color} color
 * @returns {string}
 */
function color2cmd (color) {
  return 'draw color ' + color.join(' ') + ' 255'
}


/**
 * @template T
 * @extends Array<T>
 */
class ArrayDisplay extends Array {
  /**
   * color-tag mapping
   * @type {Color[]}
   * @readonly
   */
  colors
  /**
   * display height
   * @type {number}
   * @readonly
   */
  displayHeight = 176

  /**
   * @param {Color[]} colors
   * @param {number} displayHeight
   */
  constructor (colors, displayHeight = 176) {
    super()
    this.colors = colors
    this.displayHeight = displayHeight
  }
}


/**
 * @template T
 * @extends ArrayDisplay<T>
 */
class BaseBucket extends ArrayDisplay {
  /**
   * flush threshold
   * @type {number}
   */
  static flushThreshold = 256
  /**
   * threshold of total command number
   * @type {number}
   */
  static sizeThreshold = 1000
  /**
   * threshold of total draw instruction number
   * @type {number}
   */
  static lengthThreshold = 1000

  /**
   * last tag
   * @type {number}
   */
  lastTag = -1

  get size () {
    return this.length
  }

  get remaining () {
    return this.constructor.sizeThreshold - this.size
  }

  /**
   * @param {number} oldLength
   * @param {number} newLength
   * @returns {number}
   */
  static _count (oldLength, newLength) {
    if (newLength - oldLength - 1 > this.flushThreshold) {
      return -1
    }
    if (newLength > this.lengthThreshold) {
      return -1
    }
    return newLength
  }

  /**
   * @param {Iterable<TaggedRectangle>} rects
   * @param {Color[]} colors
   * @param {number} displayHeight
   * @param {number} curTag
   * @param {number} curLength
   * @returns {number}
   */
  static count (
      rects, colors, displayHeight = 176, curTag = -1, curLength = 0) {
    let length = 1
    let lastTag = curTag
    for (const rect of rects) {
      const tag = rect.tag
      if (lastTag !== tag) {
        lastTag = tag
        length += 2
      } else {
        length++
      }
    }
    return this._count(curLength, length + curLength)
  }

  /**
   * @param {Iterable<TaggedRectangle>} rects
   * @returns {number}
   */
  count (rects) {
    return this.constructor.count(
      rects, this.colors, this.displayHeight, this.lastTag, this.length)
  }

  /**
   * @param {Iterable<TaggedRectangle>} rects
   */
  append (rects) {
    for (const rect of rects) {
      const tag = rect.tag
      if (this.lastTag !== tag) {
        this.lastTag = tag
        this.push(new TaggedRectangle(-1, -1, -1, -1, tag))
      }
      this.push(rect)
    }
    this.push(new TaggedRectangle(-1, -1, -1, -1, -1))
  }

  /**
   * @param {Iterable<TaggedRectangle>} rects
   * @param {Color[]} colors
   * @param {number} displayHeight
   * @param {string} displayName
   * @returns {string[]}
   * @throws {Error}
   */
  static generate (
      rects, colors, displayHeight = 176, displayName = 'display1') {
    const drawflush = 'drawflush ' + displayName

    /** @type {string[]} */
    const cmds = []
    for (const rect of rects) {
      if (rect.l < 0) {
        if (rect.tag < 0) {
          cmds.push(drawflush)
        } else {
          cmds.push(color2cmd(colors[rect.tag]))
        }
      } else {
        cmds.push(rect2cmd(rect, displayHeight))
      }
    }

    return cmds
  }

  /**
   * @param {string} displayName
   * @returns {string[]}
   * @throws {Error}
   */
  generate (displayName = 'display1') {
    const cmds = this.constructor.generate(
      this, this.colors, this.displayHeight, displayName)
    if (cmds.length > this.size) {
      debugger
      throw new Error('Internal error')
    }
    return cmds
  }
}


/**
 * @extends BaseBucket<TaggedRectangle>
 */
class Bucket extends BaseBucket {
}


/**
 * @extends ArrayDisplay<Bucket>
 */
class Codegen extends ArrayDisplay {
  static BucketType = Bucket
  static unordered = false

  /**
   * @param {TaggedRectangle[]} rects
   * @returns {[number, number]}
   */
  count (rects) {
    let lengthMin = -1
    let lengthMinIndex = -1
    for (let i = 0; i < this.length; i++) {
      const length = this[i].count(rects)
      if (length >= 0 && (lengthMin < 0 || length < lengthMin)) {
        lengthMin = length
        lengthMinIndex = i
      }
    }
    return [
      lengthMin >= 0 ? lengthMin : this.constructor.BucketType.count(
        rects, this.colors, this.displayHeight),
      lengthMinIndex
    ]
  }

  /**
   * @param {Iterable<TaggedRectangle>} rects
   * @param {number} index
   */
  append (rects, index = -1) {
    if (index >= 0) {
      this[index].append(rects)
    } else {
      const bucket = new this.constructor.BucketType(
        this.colors, this.displayHeight)
      this.push(bucket)
      bucket.append(rects)
    }
  }

  /**
   * @param {string} displayName
   * @returns {string[][]}
   */
  generate (displayName = 'display1') {
    return this.map(bucket => bucket.generate(displayName))
  }
}


/**
 * @extends ArrayDisplay<TaggedRectangle>
 */
class CodegenUnordered extends ArrayDisplay {
  static BucketType = Bucket
  static unordered = true

  /**
   * @param {Iterable<TaggedRectangle>} rects
   */
  append (rects) {
    for (const rect of rects) {
      this.push(rect)
    }
  }

  sort () {
    super.sort((a, b) => a.compare(b))
  }

  /**
   * @param {Iterable<TaggedRectangle>} rects
   * @param {Color[]} colors
   * @param {number} displayHeight
   * @param {string} displayName
   * @returns {string[]}
   * @throws {Error}
   */
  static generate (
      rects, colors, displayHeight = 176, displayName = 'display1') {
    const stream = (function * () {
      let lastTag = -1
      for (const rect of rects) {
        if (lastTag !== rect.tag) {
          lastTag = rect.tag
          yield new TaggedRectangle(-1, -1, -1, -1, rect.tag)
        }
        yield rect
      }
    })()

    /** @type {string[][]} */
    const cmdsArr = []
    const that = this
    while (true) {
      let total = 0
      const cmds = this.BucketType.generate((function* () {
        for (let block = 0; ; ) {
          const result = stream.next()
          if (result.done) {
            break
          }

          yield result.value
          total++
          block++

          if (block >= that.BucketType.flushThreshold ||
              total >= that.BucketType.lengthThreshold - 1) {
            yield new TaggedRectangle(-1, -1, -1, -1, -1)
            if (total >= that.BucketType.lengthThreshold - 1) {
              break
            }
            total++
            block = 0
          }
        }
      })(), colors, displayHeight, displayName)
      if (total === 0) {
        break
      }
      cmdsArr.push(cmds)
    }
    return cmdsArr
  }

  /**
   * @param {string} displayName
   * @returns {string[][]}
   * @throws {Error}
   */
  generate (displayName = 'display1') {
    return this.constructor.generate(
      this, this.colors, this.displayHeight, displayName)
  }
}


/**
 * @template T
 * @extends {BaseBucket<T>}
 */
class BaseBucketHeader extends BaseBucket {
  /**
   * number of instructions in header
   * @type {number}
   */
  static offset
  /**
   * number of micro op in one instruction
   * @type {number}
   */
  static pack
  /**
   * number of instructions for one function call
   * @type {number}
   */
  static block
  /**
   * instructions of drawer function
   * @type {string[]}
   */
  static header

  /**
   * Generate header instructions with correct display name.
   * @param {string} displayName display name
   * @returns {string[]} header instructions with correct display name
   */
  static generateHeader (displayName = 'display1') {
    const cmds = this.header.slice()
    if (displayName !== 'display1') {
      for (let i = 0; i < cmds.length; i++) {
        if (cmds[i].includes('display1')) {
          cmds[i] = cmds[i].replace('display1', displayName)
        }
      }
    }
    return cmds
  }

  /**
   * Pack operations into instructions and flush input buffer.
   * @param {(string | bigint)[]} block output instruction buffer
   * @param {bigint[]} buffer operations
   * @returns {boolean} `true` if input buffer is flushed
   */
  static flushPack (block, buffer) {
    if (buffer.length === 0) {
      return false
    }
    block.push(buffer.reduce(
      (acc, val, i) => acc | (val << (this.offset * BigInt(i)))))
    block.opCount++
    buffer.length = 0
    return true
  }

  /**
   * Pack operations into instructions and flush input buffer when input buffer
   * is full; otherwise do nothing.
   * @param {(string | bigint)[]} block output instruction buffer
   * @param {bigint[]} buffer operations
   * @returns {boolean} `true` if input buffer is flushed
   */
  static tryFlushPack (block, buffer) {
    return buffer.length >= this.pack && this.flushPack(block, buffer)
  }

  /**
   * Translate packed micro ops into valid instructions and flush input buffer.
   * @param {string[]} cmds output instruction buffer
   * @param {(string | bigint)[]} buffer instructions or packed micro ops
   * @returns {boolean} `true` if input buffer is flushed
   */
  static flushBlock (cmds, buffer) {
    if (buffer.length === 0) {
      return false
    }

    let iOp = buffer.opCount - 1
    for (let i = 0; i < buffer.length; i++) {
      const val = buffer[i]
      if (typeof val === 'string') {
        cmds.push(val)
      } else {
        cmds.push(
          `set nInst${iOp} 0x${(val <= 0x1FFFFFFFFFFFFFn ? val :
            (val & 0x1FFFFFFFFFFFFFn) - 0x20000000000000n).toString(16)}`)
        iOp--
      }
    }

    const i2lTarget = 2 + 2 * (this.block - buffer.opCount)
    if (buffer.opCount !== this.block) {
      cmds.push(`set __interrupt_i2l ${i2lTarget}`)
    }
    if (buffer.length + (buffer.opCount !== this.block) !== this.block) {
      cmds.push(`set __interrupt_i2lBlock ${cmds.length + 1 - this.block}`)
    }
    if (buffer.opCount !== this.block) {
      cmds.push(`jump ${i2lTarget} always 0 0`)
    } else {
      cmds.push('jump 1 always 0 0')
    }
    buffer.length = 0
    buffer.opCount = 0
    return true
  }

  /**
   * Translate packed micro ops into valid instructions and flush input buffer
   * when input buffer is full; otherwise do nothing.
   * @param {string[]} cmds output instruction buffer
   * @param {(string | bigint)[]} buffer instructions or packed micro ops
   * @returns {boolean} `true` if input buffer is flushed
   */
  static tryFlushBlock (cmds, buffer) {
    return (buffer.opCount >= this.block ||
        buffer.length + (buffer.opCount !== this.block) +
        (buffer.length + (buffer.opCount !== this.block) !== this.block) >=
        this.sizeThreshold - cmds.length - 1) &&
      this.flushBlock(cmds, buffer)
  }
}


/**
 * @extends {BaseBucketHeader<TaggedRectangle>}
 */
class BucketStruct extends BaseBucketHeader {
  static offset = 27n
  static pack = 2
  // = (1000-25-2*A1-CEILING((1000-25-2*A1)/(A1+1)))*2
  // 19 => 1780
  static block = 19
  static header = `jump 62 always 0 0
set __interrupt_i2l 2
set i2l_nInstC nInst18
jump 42 always 0 0
set i2l_nInstC nInst17
jump 42 always 0 0
set i2l_nInstC nInst16
jump 42 always 0 0
set i2l_nInstC nInst15
jump 42 always 0 0
set i2l_nInstC nInst14
jump 42 always 0 0
set i2l_nInstC nInst13
jump 42 always 0 0
set i2l_nInstC nInst12
jump 42 always 0 0
set i2l_nInstC nInst11
jump 42 always 0 0
set i2l_nInstC nInst10
jump 42 always 0 0
set i2l_nInstC nInst9
jump 42 always 0 0
set i2l_nInstC nInst8
jump 42 always 0 0
set i2l_nInstC nInst7
jump 42 always 0 0
set i2l_nInstC nInst6
jump 42 always 0 0
set i2l_nInstC nInst5
jump 42 always 0 0
set i2l_nInstC nInst4
jump 42 always 0 0
set i2l_nInstC nInst3
jump 42 always 0 0
set i2l_nInstC nInst2
jump 42 always 0 0
set i2l_nInstC nInst1
jump 42 always 0 0
set i2l_nInstC nInst0
jump 42 always 0 0
op add __interrupt_i2lBlock __interrupt_i2lBlock ${BucketStruct.block + 1}
set @counter __interrupt_i2lBlock  # .reti i2lBlock
set i2l_i 0
op and i2l_nInst i2l_nInstC 0x7ffffff
op shr i2l_nInstC i2l_nInstC 27
op add i2l_i i2l_i 1
jump 49 notEqual i2l_nInst 0  # .if i2l_nInst == 0
drawflush display1
jump 59 always 0 0
op and i2l_x i2l_nInst 0xff
op shr i2l_nTemp i2l_nInst 8
op and i2l_y i2l_nTemp 0xff
op shr i2l_nTemp i2l_nTemp 8
jump 56 lessThan i2l_nInst 0x4000000  # .if i2l_nInst >= 0x4000000
draw color i2l_x i2l_y i2l_nTemp 255 0 0
jump 59 always 0 0
op and i2l_w i2l_nTemp 0x1f
op shr i2l_h i2l_nTemp 5
draw rect i2l_x i2l_y i2l_w i2l_h 0 0
jump 43 lessThan i2l_i 2  # .when i2l_i < 2
op add __interrupt_i2l __interrupt_i2l 2
set @counter __interrupt_i2l  # .reti i2l
set __interrupt_i2lBlock 63`.split('\n')
  static free = BucketStruct.sizeThreshold - BucketStruct.header.length
  static batch = (BucketStruct.free / (BucketStruct.block + 1)) >> 0
  static remainder = BucketStruct.free -
                     (BucketStruct.block + 1) * BucketStruct.batch
  static lengthThreshold = BucketStruct.pack * (
    BucketStruct.block * BucketStruct.batch + Math.max(
      BucketStruct.remainder - 3, 0))

  /**
   * @param {Iterable<TaggedRectangle>} rects
   * @param {Color[]} colors
   * @param {number} displayHeight
   * @param {number} curTag
   * @param {number} curLength
   * @returns {number}
   */
  static count (
      rects, colors, displayHeight = 176, curTag = -1, curLength = 0) {
    let length = curLength + 1
    let lastTag = curTag
    for (const rect of rects) {
      const tag = rect.tag
      if (lastTag !== tag) {
        lastTag = tag
        length++
      }
      length +=
        Math.ceil((rect.r - rect.l) / 31) * Math.ceil((rect.b - rect.t) / 31)
    }
    return this._count(curLength, length)
  }

  /**
   * @param {Iterable<TaggedRectangle>} rects
   */
  append (rects) {
    for (const rect of rects) {
      const tag = rect.tag
      if (this.lastTag !== tag) {
        this.lastTag = tag
        this.push(new TaggedRectangle(-1, -1, -1, -1, tag))
      }
      for (let l = rect.l; l < rect.r; l += 31) {
        for (let t = rect.t; t < rect.b; t += 31) {
          this.push(new TaggedRectangle(
            l, t, Math.min(l + 31, rect.r), Math.min(t + 31, rect.b), tag))
        }
      }
    }
    this.push(new TaggedRectangle(-1, -1, -1, -1, -1))
  }

  /**
   * @param {Iterable<TaggedRectangle>} rects
   * @param {Color[]} colors
   * @param {number} displayHeight
   * @param {string} displayName
   * @returns {string[]}
   * @throws {Error}
   */
  static generate (
      rects, colors, displayHeight = 176, displayName = 'display1') {
    const cmds = this.generateHeader(displayName)

    /** @type {bigint[]} */
    const packBuffer = []
    /** @type {(string | bigint)[]} */
    const blockBuffer = []
    blockBuffer.opCount = 0
    for (const {l, t, r, b, tag} of rects) {
      if (l < 0) {
        if (tag < 0) {
          packBuffer.push(0n)
        } else {
          const color = colors[tag]
          packBuffer.push(BigInt(
            0x4000000 | (color[2] << 16) | (color[1] << 8) | color[0]))
        }
      } else {
        packBuffer.push(BigInt(
          ((b - t) << 21) | ((r - l) << 16) | ((displayHeight - b) << 8) | l))
      }

      if (this.tryFlushPack(blockBuffer, packBuffer)) {
        this.tryFlushBlock(cmds, blockBuffer)
      }
    }

    this.flushPack(blockBuffer, packBuffer)
    this.flushBlock(cmds, blockBuffer)
    return cmds
  }
}


class CodegenStruct extends Codegen {
  static BucketType = BucketStruct
}


class CodegenUnorderedStruct extends CodegenUnordered {
  static BucketType = BucketStruct
}


class MicroOp {
  static INVALID = -2
  static FREESTYLE = -1
  static RECT = 0
  static OFFSET_XPOS = 1
  static OFFSET_XNEG = 2
  static R = 3
  static G = 4
  static B = 5
  static X = 6
  static Y = 7

  static RECT_FLUSH = 0
  static RECT_W = 1
  static RECT_H = 2
  static RECT_NOP = 15

  /**
   * @type {number}
   */
  op
  /**
   * @type {number}
   */
  arg1
  /**
   * @type {number}
   */
  arg2
  /**
   * @type {string}
   */
  inst

  /**
   * @param {number} op
   * @param {string | number} arg1
   * @param {number} arg2
   */
  constructor (op = 0, arg1 = 0, arg2 = 0) {
    this.op = op
    if (this.op < 0) {
      this.inst = arg1
    } else {
      this.arg1 = arg1
      this.arg2 = arg2
    }
  }

  get longOp () {
    return 2 <= this.op && this.op <= 5
  }

  toNumber () {
    const inst = (this.op << 8) | this.arg1
    if (this.op <= 2) {
      return inst | (this.arg2 << 4)
    } else {
      return inst
    }
  }

  toBigint () {
    return BigInt(this.toNumber())
  }
}


/**
 * @extends {BaseBucketHeader<MicroOp>}
 */
class BucketMicroOp extends BaseBucketHeader {
  static offset = 11n
  static pack = 5
  // = (1000-50-2*A1-CEILING((1000-50-2*A1)/(A1+1)))*5
  // 19 => 4330
  static block = 19
  static header = `jump 87 always 0 0
set __interrupt_i2l 2
set i2l_nInstC nInst18
jump 42 always 0 0
set i2l_nInstC nInst17
jump 42 always 0 0
set i2l_nInstC nInst16
jump 42 always 0 0
set i2l_nInstC nInst15
jump 42 always 0 0
set i2l_nInstC nInst14
jump 42 always 0 0
set i2l_nInstC nInst13
jump 42 always 0 0
set i2l_nInstC nInst12
jump 42 always 0 0
set i2l_nInstC nInst11
jump 42 always 0 0
set i2l_nInstC nInst10
jump 42 always 0 0
set i2l_nInstC nInst9
jump 42 always 0 0
set i2l_nInstC nInst8
jump 42 always 0 0
set i2l_nInstC nInst7
jump 42 always 0 0
set i2l_nInstC nInst6
jump 42 always 0 0
set i2l_nInstC nInst5
jump 42 always 0 0
set i2l_nInstC nInst4
jump 42 always 0 0
set i2l_nInstC nInst3
jump 42 always 0 0
set i2l_nInstC nInst2
jump 42 always 0 0
set i2l_nInstC nInst1
jump 42 always 0 0
set i2l_nInstC nInst0
jump 42 always 0 0
op add __interrupt_i2lBlock __interrupt_i2lBlock ${BucketMicroOp.block + 1}
set @counter __interrupt_i2lBlock  # .reti i2lBlock
set i2l_i 0
op and i2l_nInst i2l_nInstC 0x7ff
op shr i2l_nInstC i2l_nInstC 11
op add i2l_i i2l_i 1
jump 57 greaterThanEq i2l_nInst 0x10  # .if i2l_nInst < 0x10
op mul i2l_nInst i2l_nInst 2
op add @counter @counter i2l_nInst  # .case i2l_nInst
drawflush display1
jump 84 always 0 0  # .stop
set i2l_w i2l_y
jump 55 always 0 0
set i2l_h i2l_y
draw rect i2l_x i2l_yPrev i2l_w i2l_h 0 0
set i2l_y i2l_yPrev
jump 84 always 0 0
op and i2l_nArg i2l_nInst 0xff
op and i2l_nArg1 i2l_nInst 0xf
op shr i2l_nArg2 i2l_nArg 4
op shr i2l_nOp i2l_nInst 8
op mul i2l_nOp i2l_nOp 2
op add @counter @counter i2l_nOp  # .case i2l_nOp
draw rect i2l_x i2l_y i2l_nArg1 i2l_nArg2 0 0
jump 84 always 0 0  # .stop
op add i2l_x i2l_x i2l_nArg1
jump 82 always 0 0
op sub i2l_x i2l_x i2l_nArg1
jump 82 always 0 0
set i2l_r i2l_nArg
jump 84 always 0 0  # .stop
set i2l_g i2l_nArg
jump 84 always 0 0  # .stop
set i2l_b i2l_nArg
jump 80 always 0 0
set i2l_x i2l_nArg
jump 84 always 0 0  # .stop
set i2l_yPrev i2l_y
set i2l_y i2l_nArg
jump 84 always 0 0  # .stop
draw color i2l_r i2l_g i2l_b 255 0 0
jump 84 always 0 0  # .stop
op add i2l_y i2l_y i2l_nArg2
op sub i2l_y i2l_y 8
jump 43 lessThan i2l_i 5  # .when i2l_i < 5
op add __interrupt_i2l __interrupt_i2l 2
set @counter __interrupt_i2l  # .reti i2l
set __interrupt_i2lBlock 88`.split('\n')
  static free = BucketMicroOp.sizeThreshold - BucketMicroOp.header.length
  static batch = (BucketMicroOp.free / (BucketMicroOp.block + 1)) >> 0
  static remainder = BucketMicroOp.free -
                     (BucketMicroOp.block + 1) * BucketMicroOp.batch
  static lengthThreshold = BucketMicroOp.pack * (
    BucketMicroOp.block * BucketMicroOp.batch + Math.max(
      BucketMicroOp.remainder - 3, 0))

  lastX = -128
  lastY = -128
  lastW = 0
  lastH = 0

  static longOk (length) {
    return (length + 1) % this.pack !== 0
  }

  get longOk () {
    return (this.length + 1) % this.constructor.pack !== 0
  }

  /**
   * @param {number} x
   * @param {number} y
   * @param {number} curX
   * @param {number} curY
   */
  static shortMove (x, y, curX = -128, curY = -128) {
    const dX = x - curX
    const dY = y - curY
    return -15 <= dX && dX <= 15 && -8 <= dY && dY <= 7
  }

  /**
   * @param {number} x
   * @param {number} y
   * @returns {boolean}
   */
  shortMove (x, y) {
    return this.constructor.shortMove(x, y, this.lastX, this.lastY)
  }

  /**
   * @param {number} x
   * @param {number} y
   * @param {number} curX
   * @param {number} curY
   * @param {number} curLength
   */
  static moveTo (x, y, curX = -128, curY = -128, curLength = 0) {
    const dX = x - curX
    const dY = y - curY
    if (dX === 0) {
      return dY === 0 ? [] : [new MicroOp(MicroOp.Y, y)]
    } else if (dY === 0) {
      return [new MicroOp(MicroOp.X, x)]
    } else if (-15 <= dX && dX <= 15 && -8 <= dY && dY <= 7 && (
        dX >= 0 || this.longOk(curLength))) {
      return [new MicroOp(
        dX >= 0 ? MicroOp.OFFSET_XPOS : MicroOp.OFFSET_XNEG,
        dX >= 0 ? dX : -dX, dY + 8)]
    } else {
      return [new MicroOp(MicroOp.X, x), new MicroOp(MicroOp.Y, y)]
    }
  }

  /**
   * @param {number} x
   * @param {number} y
   */
  moveTo (x, y) {
    this.push(...this.constructor.moveTo(
      x, y, this.lastX, this.lastY, this.length))
    this.lastX = x
    this.lastY = y
  }

  /**
   * @param {Iterable<TaggedRectangle>} rects
   * @param {Color[]} colors
   * @param {number} displayHeight
   * @param {number} curTag
   * @param {number} curLength
   * @param {number} curX
   * @param {number} curY
   * @param {number} curW
   * @param {number} curH
   * @returns {number}
   */
  static count (
      rects, colors, displayHeight = 176, curTag = -1, curLength = 0,
      curX = -128, curY = -128, curW = 0, curH = 0) {
    let draw = 0
    let length = curLength
    let lastTag = curTag
    let lastX = curX
    let lastY = curY
    let lastW = curW
    let lastH = curH

    for (const rect of rects) {
      let shortInsts = 0
      let longInsts = 0

      const tag = rect.tag
      if (lastTag !== tag) {
        const [oldR, oldG, oldB] = colors[lastTag] || [-1, -1, -1]
        const [R, G, B] = colors[tag]
        lastTag = tag

        if (R !== oldR) {
          longInsts++
        }
        if (G !== oldG) {
          longInsts++
        }
        longInsts++
        draw++
      }

      const x = rect.l
      const y = displayHeight - rect.b
      for (const inst of this.moveTo(x, y, lastX, lastY)) {
        if (inst.longOp) {
          longInsts++
        } else {
          shortInsts++
        }
      }
      lastX = x
      lastY = y

      const w = rect.r - rect.l
      const h = rect.b - rect.t
      if ((w > 15 || h > 15) && lastW !== w) {
        shortInsts += 2
        lastW = w
      }

      while (true) {
        if (longInsts > 0 && this.longOk(length)) {
          longInsts--
          length++
        } else if (shortInsts > 0) {
          shortInsts--
          length++
        } else if (longInsts > 0) {
          length++
        } else {
          break
        }
      }

      if (w <= 15 && h <= 15) {
        length++
      } else {
        length += 2
        lastH = h
      }
      draw++
    }
    length++

    if (draw > this.flushThreshold) {
      return -1
    }
    if (length > this.lengthThreshold) {
      return -1
    }
    return length
  }

  /**
   * @param {Iterable<TaggedRectangle>} rects
   * @returns {number}
   */
  count (rects) {
    return this.constructor.count(
      rects, this.colors, this.displayHeight, this.lastTag, this.length,
      this.lastX, this.lastY, this.lastW, this.lastH)
  }

  /**
   * @param {MicroOp} inst
   */
  pushLong (inst) {
    if (!this.longOk) {
      this.push(new MicroOp(MicroOp.RECT, MicroOp.RECT_NOP))
    }
    this.push(inst)
  }

  /**
   * @param {MicroOp} inst
   */
  pushFreestyle (inst) {
    while (this.length % this.constructor.pack !== 0) {
      this.push(new MicroOp(MicroOp.RECT, MicroOp.RECT_NOP))
    }
    this.push(inst)
    for (let i = 1; i < 3 * this.constructor.pack; i++) {
      this.push(new MicroOp(MicroOp.INVALID))
    }
  }

  /**
   * @param {Iterable<TaggedRectangle>} rects
   */
  append (rects) {
    /** @type {MicroOp[]} */
    const shortInsts = []
    /** @type {MicroOp[]} */
    const longInsts = []
    for (const rect of rects) {
      const tag = rect.tag
      if (this.lastTag !== tag) {
        const [oldR, oldG, oldB] = this.colors[this.lastTag] || [-1, -1, -1]
        const [R, G, B] = this.colors[tag]
        this.lastTag = tag

        if (R !== oldR) {
          longInsts.push(new MicroOp(MicroOp.R, R))
        }
        if (G !== oldG) {
          longInsts.push(new MicroOp(MicroOp.G, G))
        }
        longInsts.push(new MicroOp(MicroOp.B, B))
      }

      const x = rect.l
      const y = this.displayHeight - rect.b
      for (const inst of this.constructor.moveTo(
          x, y, this.lastX, this.lastY)) {
        if (inst.longOp) {
          longInsts.push(inst)
        } else {
          shortInsts.push(inst)
        }
      }
      this.lastX = x
      this.lastY = y

      const w = rect.r - rect.l
      const h = rect.b - rect.t
      if ((w > 15 || h > 15) && this.lastW !== w) {
        shortInsts.push(new MicroOp(MicroOp.Y, w))
        shortInsts.push(new MicroOp(MicroOp.RECT, MicroOp.RECT_W))
        this.lastW = w
      }

      while (true) {
        if (longInsts.length > 0 && this.longOk) {
          this.push(longInsts.shift())
        } else if (shortInsts.length > 0) {
          this.push(shortInsts.shift())
        } else if (longInsts.length > 0) {
          this.push(new MicroOp(MicroOp.RECT, MicroOp.RECT_NOP))
        } else {
          break
        }
      }

      if (w <= 15 && h <= 15) {
        this.push(new MicroOp(MicroOp.RECT, w, h))
      } else {
        this.push(new MicroOp(MicroOp.Y, h))
        this.push(new MicroOp(MicroOp.RECT, MicroOp.RECT_H))
        this.lastH = h
      }
    }
    this.push(new MicroOp())
  }

  /**
   * @param {Iterable<MicroOp>} insts
   * @param {Color[]} colors
   * @param {number} displayHeight
   * @param {string} displayName
   * @returns {string[]}
   * @throws {Error}
   */
  static generate (
      insts, colors, displayHeight = 176, displayName = 'display1') {
    const cmds = this.generateHeader(displayName)

    /** @type {bigint[]} */
    const packBuffer = []
    /** @type {(string | bigint)[]} */
    const blockBuffer = []
    blockBuffer.opCount = 0
    for (const inst of insts) {
      switch (inst.op) {
        case MicroOp.INVALID:
          break
        case MicroOp.FREESTYLE:
          if (this.flushPack(blockBuffer, packBuffer)) {
            this.tryFlushBlock(cmds, blockBuffer)
          }
          blockBuffer.push(inst.inst)
          this.tryFlushBlock(cmds, blockBuffer)
          break
        default:
          packBuffer.push(inst.toBigint())
          if (this.tryFlushPack(blockBuffer, packBuffer)) {
            this.tryFlushBlock(cmds, blockBuffer)
          }
      }
    }

    this.flushPack(blockBuffer, packBuffer)
    this.flushBlock(cmds, blockBuffer)
    return cmds
  }
}


class CodegenMicroOp extends Codegen {
  static BucketType = BucketMicroOp
}


class CodegenUnorderedMicroOp extends CodegenUnordered {
  static BucketType = BucketMicroOp
}


/**
 * @param {number[]} matrix
 * @param {number} width
 * @param {number} height
 * @param {Orthogonalizer} orthogonalizer
 * @param {typeof Codegen} CodegenType
 * @param {Color[]} colors
 * @param {number} displayHeight
 * @param {string} displayName
 * @param {OrthogonalizerOption} [options]
 * @returns {[string[][], number[]]}
 */
function matrix2buckets (
    matrix, width, height, orthogonalizer, CodegenType,
    colors, displayHeight = 176, displayName = 'display1', options = {}) {
  const codegen = new CodegenType(colors, displayHeight)

  if (CodegenType.unordered) {
    const [rects, real] = orthogonalizer(
      matrix, width, height, 0, 0, -1, -1, options)
    codegen.append(rects)
    codegen.sort()
    return [codegen.generate(displayName), real]
  }

  /** @type {number[]} */
  const real = new Array(matrix.length).fill(-1)
  /** @type {[number, TaggedRectangle[], number[]][]} */
  const prevs = []

  const options_ = Object.assign({}, options)
  const dynamicBackground = !('background' in options)

  for (let top = 0, bottom = 1; top < height; bottom++) {
    // calculate rects
    if (dynamicBackground) {
      options_.background =
        matrixBackground(matrix, width, height, 0, top, -1, bottom)
    }
    const [rects, rectsReal] = orthogonalizer(
      matrix, width, height, 0, top, -1, bottom, options_)
    rects.unshift(new TaggedRectangle(
      0, top, width, bottom, options_.background))

    // if under threshold, save candidate
    if (rects.length <= CodegenType.BucketType.flushThreshold + 1 ||
        bottom - top === 1) {
      if (bottom - top > 1) {
        while (prevs.length > 0 &&
               rects.length <= prevs[prevs.length - 1][1].length) {
          // the current one beats the previous
          prevs.pop()
        }
      } else if (rects.length > CodegenType.BucketType.flushThreshold + 1) {
        // out of threshold within 1 line
        console.warn(top, rects.length)
      }
      // save candidate
      prevs.push([bottom, rects, rectsReal])
    }

    // if exceed threshold, determine which cmd bucket to use
    if (rects.length > CodegenType.BucketType.flushThreshold + 1 ||
        bottom >= height) {
      // find a best match
      let lengthMax = -1
      let lengthMaxIndex = -1
      let lengthMaxPrevIndex = -1
      for (let i = 0; i < prevs.length; i++) {
        const [length, lengthIndex] = codegen.count(prevs[i][1])
        if (length >= 0 && length >= lengthMax) {
          lengthMax = length
          lengthMaxIndex = lengthIndex
          lengthMaxPrevIndex = i
        }
      }
      if (lengthMax < 0) {
        debugger
        throw new Error('Internal error')
      }

      const [bottom_, rects, rectsReal] = prevs[lengthMaxPrevIndex]
      bottom = bottom_
      codegen.append(rects, lengthMaxIndex)

      // render real matrix
      for (let h = top; h < bottom; h++) {
        for (let w = 0; w < width; w++) {
          if (rectsReal[width * h + w] === undefined) {
            debugger
          }
          real[width * h + w] = rectsReal[width * h + w]
        }
      }

      // go next
      top = bottom
      prevs.length = 0
    }
  }

  return [codegen.generate(displayName), real]
}


/********** main **********/

/**
 * @typedef Color
 * @type {[number, number, number]}
 */

/** @type {HTMLFormElement} */
const form = document.getElementById('image2logic')

const savedKeys = [
  'width', 'height', 'blur', 'noise', 'K', 'display-name', 'spliter', 'codegen',
]
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
  // CHROME BUG #1335626
  // ctxRaw.getImageData(0, 0, 1, 1)
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
  /** @type {boolean} */
  let unordered
  /** @type {Orthogonalizer} */
  let orthogonalizer
  switch (form.elements['spliter'].value) {
    case 'greedy':
    default:
      orthogonalizer = matrix2rectsGreedy
      unordered = true
      break
    case 'greedy-block':
      orthogonalizer = matrix2rectsGreedy
      unordered = false
      break
    case 'overlapping':
      orthogonalizer = matrix2rectsOverlapping
      unordered = false
      break
  }
  /** @type {typeof Codegen} */
  let CodegenType
  switch (form.elements['codegen'].value) {
    case 'direct':
    default:
      CodegenType = unordered ? CodegenUnordered : Codegen
      break
    case 'struct':
      CodegenType = unordered ? CodegenUnorderedStruct : CodegenStruct
      break
    case 'microop':
      CodegenType = unordered ? CodegenUnorderedMicroOp : CodegenMicroOp
      break
  }
  /** @type {HTMLCanvasElement} */
  const canvas = form.getElementsByClassName('image2logic--canvas')[0]
  const [buckets, tagsReal] = matrix2buckets(
    tags, imageData.width, imageData.height, orthogonalizer, CodegenType,
    colorsRgb, canvas.height, form.elements['display-name'].value || 'display1',
    {
      noise: parseInt(form.elements['noise'].value) || 0,
    })
  /** @type {HTMLSpanElement} */
  const spanCommandsNumber =
    form.getElementsByClassName('image2logic--command-numbers')[0]
  spanCommandsNumber.textContent = buckets.map(cmds => cmds.length).join(', ')
  /** @type {HTMLTextAreaElement} */
  const output = form.elements['output']
  output.value = ''
  /** @type {HTMLElement} */
  const elmCopyers = form.getElementsByClassName('image2logic--copyers')[0]
  elmCopyers.textContent = ''
  for (let i = 0; i < buckets.length; i++) {
    const cmds = buckets[i]
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
