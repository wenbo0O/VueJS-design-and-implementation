const VNODE_TYPES = {
  Text: Symbol(),
  Comment: Symbol(),
  Fragment: Symbol()
}

function createRenderer (options) {
  // 通过 options 取得操作 DOM 的 API
  const {
    createElement,
    insert,
    setElementText,
    patchProps,
    createText,
    setText,
    createComment,
    setComment
  } = options

  function render (vnode, container) {
    if (vnode) {
      // 新 vnode 存在，将其与旧 vnode 一起传递给 patch 函数，进行更新
      patch(container._vnode, vnode, container)
    } else {
      if (container._vnode) {
        unmount(container._vnode)
      }
    }

    // 把 vnode 存储到 container._vnode 下，即后续渲染中的旧 vnode
    container._vnode = vnode
  }

  function unmount (vnode) {
    if (vnode.type === VNODE_TYPES.Fragment) {
      vnode.children.forEach(c => unmount(c))
      return
    }

    // 获取 el 的父元素
    const parent = vnode.el.parentNode
    // 调用父元素的 removeChild 移除元素
    if (parent) {
      parent.removeChild(vnode.el)
    }
  }

  function patch (n1, n2, container, anchor) {
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
        // 挂载时将锚点元素作为第三个参数传递给 mountElement 函数
        mountElement(n2, container, anchor)
      } else {
        patchElement(n1, n2)
      }
    } else if (typeof type === 'object') {
      // 如果 n2.type 是对象，则它描述的是组件
    } else if (type === VNODE_TYPES.Text) {
      // 处理文本节点
      if (!n1) {
        // 如果没有旧节点，则进行挂载
        const el = n2.el = createText(n2.children)
        // 将文本节点插入到容器中
        insert(el, container)
      } else {
        // 如果旧 vnode 存在，只需要使用新文本节点的内容替换更新旧文本节点即可
        const el = n2.el = n1.el
        if (n2.children !== n1.children) {
          setText(el, n2.children)
        }
      }
    } else if (type === VNODE_TYPES.Comment) {
      if (!n1) {
        const el = n2.el = createComment(n2.children)
        insert(el, container)
      } else {
        const el = n2.el = n1.el
        if (n2.children !== n1.children) {
          setComment(el, n2.children)
        }
      }
    } else if (type === VNODE_TYPES.Fragment) {
      // 处理 Fragment 类型的 vnode
      if (!n1) {
        n2.children.forEach(child => patch(null, child, container))
      } else {
        // 如果旧 vnode 存在，则只需要更新 Fragment 的 children 即可
        patchChildren(n1, n2, container)
      }
    }
  }

  function shouldSetAsProps (el, key, value) {
    // 特殊处理
    if (key === 'form' && el.tagName === 'INPUT') return false
    // 兜底
    return key in el
  }

  function mountElement (vnode, container, anchor) {
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
    insert(el, container, anchor)
  }

  function patchElement (n1, n2) {
    const el = n2.el = n1.el
    const oldProps = n1.props
    const newProps = n2.props

    // 第一步：更新 props
    for (const key in newProps) {
      if (newProps[key] !== oldProps[key]) {
        patchProps(el, key, oldProps[key], newProps[key])
      }
    }
    for (const key in oldProps) {
      if (!key in newProps) {
        patchProps(el, key, oldProps[key], null)
      }
    }

    // 第二步：更新 children
    patchChildren(n1, n2, el)
  }

  function patchChildren (n1, n2, container) {
    // 判断新子节点的类型是否是文本节点
    if (typeof n2.children === 'string') {
      // 旧子节点的类型有三种可能
      // 只有当旧子节点为一组子节点时，才需要逐个卸载，其他情况什么都不需要做
      if (Array.isArray(n1.children)) {
        n1.children.forEach(c => unmount(c))
      }
      // 最后将新的文本节点内容设置给容器元素
      setElementText(container, n2.children)
    } else if (Array.isArray(n2.children)) {
      // 如果新子节点的类型是一组子节点
      // 判断旧子节点是否也是一组子节点
      if (Array.isArray(n1.children)) {
        // 封装 patchKeyedChildren 函数处理两组子节点
        patchKeyedChildren(n1, n2, container)
      } else {
        // 此时：
        // 旧子节点要么是文本子节，要么不存在
        // 无论哪种情况，我们都只需要将容器清空，然后将新的一组子节点逐个挂载即可
        setElementText(container, '')
        n2.children.forEach(c => patch(null, c, container))
      }
    } else {
      // 代码运行到这里，说明新的子节点不存在
      // 如果旧的子节点是一组子节点，只需要逐个卸载即可
      if (Array.isArray(n1.children)) {
        n1.children.forEach(c => unmount(c))
      } else if (typeof n1.children === 'string') {
        // 旧子节点是文本节点，清空内容即可
        setElementText(container, '')
      }
      // 如果也没有旧子节点，那么什么都不需要做
    }
  }

  function patchKeyedChildren (n1, n2, container) {
    const newChildren = n2.children
    const oldChildren = n1.children

    // *remark：处理相同的前置节点指针 j
    // 索引 j 指向新旧两组子节点的开头
    let j = 0
    let oldVNode = oldChildren[j]
    let newVNode = newChildren[j]
    // while 循环向后遍历，直到遇到不同 key 值的节点为止
    while (j < newChildren.length - 1 && oldVNode.key === newVNode.key) {
      // 调用 patch() 函数进行更新
      patch(oldVNode, newVNode, container)
      // 更新索引，让其递增
      j++
      oldVNode = oldChildren[j]
      newVNode = newChildren[j]
    }

    // *remark：处理相同的后置节点双指针 oldEnd newEnd
    // 索引 oldEnd 指向旧的一组子节点的最后一个节点
    let oldEnd = oldChildren.length - 1
    // 索引 newEnd 指向新的一组子节点的最后一个节点
    let newEnd = newChildren.length - 1

    oldVNode = oldChildren[oldEnd]
    newVNode = newChildren[newEnd]

    // while 循环从后向前遍历，直到遇到不同 key 值的节点
    while ((oldEnd > -1 && newEnd > -1) && oldVNode.key === newVNode.key) {
      // 调用 patch() 函数进行更新
      patch(oldVNode, newVNode, container)
      // 递减 oldEnd 和 newEnd
      oldEnd--
      newEnd--
      oldVNode = oldChildren[oldEnd]
      newVNode = newChildren[newEnd]
    }

    // 预处理完毕后，如果满足以下条件，则说明从 j ---> newEnd 之间的节点应作为新节点挂载
    if (j > oldEnd && j <= newEnd) {
      // remark1: newEnd 没有越界，说明需要挂载
      // 锚点的索引
      const anchorIndex = newEnd + 1
      // 锚点元素
      const anchor = anchorIndex < newChildren.length
        ? newChildren[anchorIndex].el
        : null

      // 采用 while 循环，调用 patch 函数逐个挂载新增节点
      while (j <= newEnd) {
        patch(null, newChildren[j++], container, anchor)
      }
    } else if (j > newEnd && j <= oldEnd) {
      // remark2: oldEnd 没有越界，说明需要删除
      // j ---> oldEnd 之间的节点都应该被卸载
      while (j <= oldEnd) {
        unmount(oldChildren[j++])
      }
    }
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
  setElementText (el, text) {
    el.textContent = text
  },
  // 用于在给定的 parent 下添加指定元素
  insert (el, parent, anchor = null) {
    parent.insertBefore(el, anchor)
  },
  // 将属性设置相关的操作封装到 patchProps 函数中，并作为渲染器选项传递
  patchProps (el, key, prevValue, nextValue, shouldSetAsProps) {
    if (/^on/.test(key)) {
      const invokers = el._vei || (el._vei = {})
      let invoker = invokers[key]
      const name = key.slice(2).toLowerCase()

      if (nextValue) {
        if (!invoker) {
          // 将事件处理函数缓存到 `el._vei[key]` 下，避免覆盖
          invoker = el._vei[key] = (e) => {
            // 如果事件发生的时间 早于 事件处理函数被绑定的时间
            // 则不执行事件处理函数
            if (e.timeStamp < invoker.attached) return

            // 如果 invoker.value 是一个数组，则遍历它并逐个调用事件处理函数
            if (Array.isArray(invoker.value)) {
              invoker.value.forEach(fn => fn(e))
            } else {
              // 否则直接作用函数调用
              invoker.value(e)
            }
          }
          // 将真正的事件处理函数赋值给 invoker.value
          invoker.value = nextValue
          // 添加 invoker.attached 属性，存储事件处理函数被绑定的时间
          invoker.attached = performance.now()
          // 绑定 invoker 作为事件处理函数
          el.addEventListener(name, invoker)
        } else {
          // 如果 invoker 存在，意味着更新，只需要更新 invoker.value 的值即可
          invoker.value = nextValue
        }
      } else if (invoker) {
        // 新的事件绑定函数不存在，且之前绑定的 invoker 存在，则移除绑定
        el.removeEventListener(name, invoker)
      }
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
  },
  // 创建文本节点
  createText (text) {
    return document.createTextNode(text)
  },
  // 设置文本节点的内容
  setText(el, text) {
    el.nodeValue = text
  },
  // 创建注释节点
  createComment (comment) {
    return document.createComment(comment)
  },
  // 设置注释节点的内容
  setComment (el, text) {
    el.nodeValue = text
  }
})
