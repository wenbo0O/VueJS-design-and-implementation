export default {
  data() {
    return {
      count: 1
    }
  },
  // remark: 模拟组件编译错误
  // if,
  setup() {
    return function () {
      return {
        type: 'div',
        children: `count is: ${this.count}`
      }
    }
  }
}
