/* eslint-disable */
/*
 * @author qiqiboy
 * @github https://github.com/qiqiboy/sketch
 */

'use strict'

let states = {
    start: 1,
    down: 1,
    move: 2,
    end: 3,
    up: 3,
    cancel: 3
  },
  evs = [],
  slice = [].slice,
  event2type = {},
  event2code = {},
  POINTERS = {},
  dpr = window.devicePixelRatio || 1

typeof [].forEach === 'function' && 'mouse touch pointer MSPointer-'.split(' ').forEach(function (prefix) {
  let _prefix = /pointer/i.test(prefix) ? 'pointer' : prefix
  Object.keys(states).forEach(function (endfix) {
    let code = states[endfix],
      ev = camelCase(prefix + endfix)
    evs.push(ev)
    POINTERS[_prefix] = {}
    event2type[ev.toLowerCase()] = _prefix
    event2code[ev.toLowerCase()] = code
  })
})

function camelCase (str) {
  return (str + '').replace(/-([a-z]|[0-9])/ig, function (all, letter) {
    return (letter + '').toUpperCase()
  })
}

function filterEvent (oldEvent) {
  let ev = {},
    eventtype,
    pointers,
    pointer

  ev.oldEvent = oldEvent
  ev.type = oldEvent.type.toLowerCase()
  ev.eventType = event2type[ev.type] || ev.type
  ev.eventCode = event2code[ev.type] || 0
  ev.preventDefault = function () {
    oldEvent.preventDefault()
  }

  pointers = POINTERS[ev.eventType]
  switch (ev.eventType) {
    case 'mouse':
    case 'pointer':
      var id = oldEvent.pointerId || 0
      ev.eventCode === 3 ? delete pointers[id] : pointers[id] = oldEvent
      ev.changedPointers = [{id: id, clientX: oldEvent.clientX, clientY: oldEvent.clientY}]
      ev.pointers = Object.keys(pointers).map(function (id) {
        return {id: id, clientX: pointers[id].clientX, clientY: pointers[id].clientY}
      })
      break
    case 'touch':
      POINTERS[ev.eventType] = pointers = {}
      ev.changedPointers = slice.call(oldEvent.changedTouches).map(function (pointer) {
        return {id: pointer.identifier, clientX: pointer.clientX, clientY: pointer.clientY}
      })
      ev.pointers = slice.call(POINTERS[ev.eventType] = pointers = oldEvent.touches).map(function (pointer) {
        return {id: pointer.identifier, clientX: pointer.clientX, clientY: pointer.clientY}
      })
      break
  }

  if (pointer = ev.pointers[0]) {
    ev.clientX = pointer.clientX
    ev.clientY = pointer.clientY
  }

  ev.length = ev.pointers.length

  return ev
}

let defaultConfig = {
  lineWidth: 5,
  color: '#000',
  erase: false,
  bgcolor: 'transparent',
  touchAction: 'none'
}

class Sketch {
  constructor (refCanvas, config = defaultConfig) {
    this.events = {}
    this.actions = []
    this.canvas = refCanvas

    this.ctx = this.canvas.getContext('2d')

    typeof config === 'object' && 'width height lineWidth color bgcolor multi'.split(' ').forEach(function (prop) {
      this[prop] = config[prop] || defaultConfig[prop]
      console.log(prop, config[prop], defaultConfig[prop], this[prop])
    }.bind(this))

    evs.forEach(function (ev) {
      this.canvas.addEventListener(ev, this, false)
    }.bind(this))

    var tempPens = []

    this.on({
      start: function () {
        tempPens[arguments[2]] = {
          width: this.lineWidth,
          color: this.color,
          erase: this.erase,
          pens: [arguments]
        }
      },
      move: function () {
        var action = tempPens[arguments[2]]
        action.pens.push(arguments)
        this.draw({
          width: action.width,
          color: action.color,
          erase: action.erase,
          pens: action.pens.slice(-2)
        })
      },
      end: function (id) {
        if (tempPens[id] && tempPens[id].pens.length > 1) {
          this.actions.push(tempPens[id])
          delete tempPens[id]
        }
      },
      redraw: function () {
        var ctx = this.ctx
        if (this.bgcolor !== 'transparent') {
          ctx.fillStyle = this.bgcolor
          ctx.fillRect(0, 0, this.width, this.height)
        }
      }
    }).clear()
  }

  handleEvent (oldEvent) {
    var ev = filterEvent(oldEvent),
      rect = this.canvas.getBoundingClientRect(),
      isRight = !this.pointerType || this.pointerType == ev.eventType

    switch (ev.eventCode) {
      case 1:
        clearTimeout(this.eventTimer)
        if (!this.pointerType) {
          this.pointerType = ev.eventType
        }
        if (isRight) {
          if (this.multi || ev.length < 2) {
            this.moving = true
            ev.changedPointers.forEach(function (pointer) {
              this.fire('start', pointer.clientX - rect.left, pointer.clientY - rect.top, pointer.id)
            }.bind(this))
          } else {
            ev.pointers.forEach(function (pointer) {
              this.fire('end', pointer.id)
            }.bind(this))
          }
        }
        break
      case 2:
        if (this.moving && isRight) {
          if (this.multi || ev.length < 2) {
            ev.preventDefault()
            ev.changedPointers.forEach(function (pointer) {
              this.fire('move', pointer.clientX - rect.left, pointer.clientY - rect.top, pointer.id)
            }.bind(this))
          }
        }
        break
      case 3:
        if (isRight) {
          if (this.multi || !ev.length) {
            ev.changedPointers.forEach(function (pointer) {
              this.fire('end', pointer.id)
            }.bind(this))
          } else if (ev.length == 1) {
            this.moving = true
            this.fire('start', ev.clientX - rect.left, ev.clientY - rect.top, ev.pointers[0].id)
          }
        }

        if (!ev.length) {
          delete this.moving
          this.eventTimer = setTimeout(function () {
            delete this.pointerType
          }.bind(this), 30)
        }
        break
    }
  }

  on (ev, callback) {
    if (typeof ev == 'object') {
      Object.keys(ev).forEach(function (_e) {
        this.on(_e, ev[_e])
      }.bind(this))
    } else {
      if (!this.events[ev]) {
        this.events[ev] = []
      }
      this.events[ev].push(callback)
    }
    return this
  }

  fire (ev) {
    var args = [].slice.call(arguments, 1);
    (this.events[ev] || []).forEach(function (callback) {
      if (typeof callback == 'function') {
        callback.apply(this, args)
      }
    }.bind(this))
    return this
  }

  draw (action) {
    var ctx = this.ctx,
      isTransparent = !this.bgcolor || this.bgcolor == 'transparent'
    ctx.lineWidth = action.width
    ctx.lineJoin = ctx.lineCap = 'round'
    ctx.strokeStyle = action.erase ? isTransparent ? '#000' : this.bgcolor : action.color
    ctx.globalCompositeOperation = action.erase && isTransparent ? 'destination-out' : 'source-over'

    ctx.beginPath()
    action.pens.forEach(function (pos, step) {
      ctx[step ? 'lineTo' : 'moveTo'].apply(ctx, pos)
    })
    ctx.stroke()

    return this
  }

  reDraw () {
    this.ctx.clearRect(0, 0, this.width, this.height)
    this.fire('redraw')
    this.actions.forEach(this.draw.bind(this))
    return this
  }

  cancel (num) {
    this.actions.splice(-(num || 1))
    return this.reDraw()
  }

  clear () {
    this.actions.length = 0
    return this.reDraw()
  }

  toDataUrl (type) {
    return this.canvas.toDataURL(type)
  }

  toBlob () {
    return (this.canvas.toBlob || function (callback, type) {
      if ('mozGetAsFile' in this) {
        return callback(this.mozGetAsFile('blob', type))
      }
      var dataUrl = this.toDataURL(type).split(','),
        bytestr = atob(dataUrl[1]),
        buffer = new Uint8Array(bytestr.length),
        i, len
      for (i = 0, len = buffer.length; i < len; i++) {
        buffer[i] = bytestr.charCodeAt(i)
      }
      callback(new Blob([buffer.buffer], {type: type || dataUrl[0].split(/[:;]/)[1]}))
    }).apply(this.canvas, arguments)
  }
}

if (typeof Object.defineProperties === 'function') {
  'width height'.split(' ').forEach(function (prop) {
    Object.defineProperty(Sketch.prototype, prop, {
      get: function () {
        return this.canvas[prop] / dpr
      },
      set: function (value) {
        this.canvas[prop] = value * dpr
        this.ctx.scale(dpr, dpr) // retina support
      },
      enumerable: true
    })
  })

  Object.defineProperty(Sketch.prototype, 'steps', {
    get: function () {
      return this.actions.length
    },
    enumerable: true
  })
}

export default Sketch
