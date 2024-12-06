function createRenderer(options) {
  // 通过 options 取得操作 DOM 的 API
  const {
    createElement,
    insert,
    setElementText,
    patchProps
  } = options

  function render(vnode, container) {
    if (vnode) {
      // 新 vnode 存在，将其与旧 vnode 一起传递给 patch 函数，进行更新
      patch(container._vnode, vnode, container)
    } else {
      // 手动卸载 vnode传null
      if (container._vnode) {
        unmount(container._vnode)
      }
    }

    // 把 vnode 存储到 container._vnode 下，即后续渲染中的旧 vnode
    container._vnode = vnode
  }

  function unmount(vnode) {
    // 获取 el 的父元素
    const parent = vnode.el.parentNode
    // 调用父元素的 removeChild 移除元素
    if (parent) {
      parent.removeChild(vnode.el)
    }
  }

  function patch(n1, n2, container) {
    console.log('🚀: ~ patch ~ n1, n2:', n1, n2)
    // n1 存在，则对比 n1 和 n2 的类型
    if (n1 && n1.type !== n2.type) {
      // 如果两者类型不一致，则直接将旧 vnode 卸载
      unmount(n1)
      n1 = null
    }

    // 代码运行到这里，证明 n1 和 n2 所描述的内容相同
    const { type } = n2
    // 如果 n2.type 是字符串类型，则它描述的是普通标签元素
    if (typeof type === 'string') {
      if (!n1) {
        mountElement(n2, container)
      } else {
        // 更新
        console.log('需要更新')
        // patchElement(n1, n2)
      }
    } else if (typeof type === 'object') {
      // 如果 n2.type 是对象，则它描述的是组件
    } else if (type === 'xxx') {
      // 处理其他类型的 vnode
    }
  }

  function shouldSetAsProps(el, key, value) {
    // 特殊处理
    if (key === 'form' && el.tagName === 'INPUT') return false
    // 兜底
    return key in el
  }

  function mountElement(vnode, container) {
    // 创建 DOM 元素，并让 vnode.el 引用真实 DOM 元素
    const el = vnode.el = createElement(vnode.type)

    // 处理子节点，如果子节点是字符串，代表元素具有文本节点
    if (typeof vnode.children === 'string') {
      setElementText(el, vnode.children)
    } else if (Array.isArray(vnode.children)) {
      // 如果 children 是一个数组，则遍历每一个子节点，并调用 patch 函数挂载它们
      vnode.children.forEach(child => {
        patch(null, child, el)
      })
    }

    // 如果 vnode.props 存在，则处理
    if (vnode.props) {
      // 遍历 vnode.props，并将属性设置到元素上
      for (const key in vnode.props) {
        // 调用 patchProps 即可
        patchProps(el, key, null, vnode.props[key], shouldSetAsProps)
      }
    }

    // 将元素添加到容器中
    insert(el, container)
  }

  return {
    render
  }
}

function normalizeClass(value) {
  let res = ''
  if (typeof value === 'string') {
    res = value
  } else if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const normalized = normalizeClass(value[i])
      if (normalized) {
        res += normalized + ' '
      }
    }
  } else if (Object.prototype.toString.call(value) === '[object Object]') {
    for (const name in value) {
      if (value[name]) {
        res += name + ' '
      }
    }
  }
  return res.trim()
}

const renderer = createRenderer({
  // 用于创建元素
  createElement(tag) {
    return document.createElement(tag)
  },
  // 用于设置元素的文本节点
  setElementText(el, text) {
    el.textContent = text
  },
  // 用于在给定的 parent 下添加指定元素
  insert(el, parent, anchor = null) {
    parent.insertBefore(el, anchor)
  },
  // 将属性设置相关的操作封装到 patchProps 函数中，并作为渲染器选项传递
  patchProps(el, key, prevValue, nextValue, shouldSetAsProps) {
    // 匹配以 on 开头的属性，视其为事件
    if (/^on/.test(key)) {
      /*
      // _vei
      {
        onClick: {
          value: () => {
            alert('clicked')
          }
        },
        ondblclick: {
          value: [fn1, fn2]
        }
      } */
      const invokers = el._vei || (el._vei = {})
      // 事件回调函数集合
      let invoker = invokers[key]
      // onClick ---> click
      const name = key.slice(2).toLowerCase()

      if (nextValue) {
        if (!invoker) {
          // 将事件处理函数缓存到 `el._vei[key]` 下，避免覆盖
          invoker = el._vei[key] = (e) => {
            // 如果 invoker.value 是一个数据，则遍历它并逐个调用事件处理函数
            if (Array.isArray(invoker.value)) {
              invoker.value.forEach(fn => fn(e))
              // invoker.value.forEach(fn => fn.call(el, e))
            } else {
              // 否则直接作用函数调用
              invoker.value(e)
              // invoker.value.call(el, e)
            }
          }
          // 将真正的事件处理函数赋值给 invoker.value
          invoker.value = nextValue
          // 绑定 invoker 作为事件处理函数
          el.addEventListener(name, invoker)
        } else {
          // 如果 invoker 存在，意味着更新，只需要更新 invoker.value 的值即可
          // remark：减少一次removeEventListener，直接更新事件处理函数即可
          invoker.value = nextValue
        }
      } else if (invoker) {
        // 新的事件绑定函数不存在，且之前绑定的 invoker 存在，则移除绑定
        el.removeEventListener(name, invoker)
      }
      console.log('🚀: ~ patchProps ~ invoker:', invokers)
    } else if (key === 'class') {
      el.className = nextValue || ''
    } else if (shouldSetAsProps(el, key, nextValue)) {
      // 获取该 DOM Properties 的类型
      const type = typeof el[key]

      // 如果是布尔类型，并且值是空字符串，则将值矫正为 true
      if (type === 'boolean' && nextValue === '') {
        el[key] = true
      } else {
        el[key] = nextValue
      }
    } else {
      // 如果要设置的属性没有对应的 DOM Properties，则使用 setAttribute 函数设置属性
      el.setAttribute(key, nextValue)
    }
  }
})
