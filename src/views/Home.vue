<template>
  <div class="home">
    <at-modal v-model="modal" :title="dlName" :maskClosable="false" :closeOnPressEsc="false" :showClose="canDl">
      <div>
        <div class="dl-info">
          <p>正在获取分卷信息……共 {{ divisionNum }} 卷</p>
          <p>正在获取章节信息……共 {{ chapterNum }} 章</p>
          <p>正在获取章节内容……{{ dlProgressText }}</p>
        </div>
      </div>
      <div slot="footer">
        <p> {{ second }} 秒 </p>
        <at-button type="primary" :disabled="!canDl" @click="dlBook">{{ dlButton }}</at-button>
        <at-button type="primary" :disabled="canDl" @click="stopBook">{{ stopButton }}</at-button>
      </div>
    </at-modal>
    <div class="nav-wrapper">
      <div class="title" @click="goGit">
        HBooker Extractor
      </div>

      <div class="nav-download">
            <at-button type="primary" @click="dlAllBook">一键下载</at-button>
            <i class="icon icon-arrow-right"></i>
            <at-input v-model="start_index" @input="setStartIndex($event.target)">
              <template slot="prepend">
              <span>开始序号</span>
              </template>
            </at-input>
            <at-input v-model="end_index" @input="setEndIndex($event.target)">
              <template slot="prepend">
              <span>结束序号</span>
              </template>
            </at-input>
      </div>

      <div class="need-login" v-if="!readInfo['reader_name']">
        未登录
      </div>
      <div class="shelves" v-else>
        <at-dropdown @on-dropdown-command="switchShelf">
          <span>
            {{ currentShelf['shelf_name'] }}
            <i class="icon icon-chevron-down"></i>

          </span>
          <at-dropdown-menu slot="menu" class="shelf-menu">
            <at-dropdown-item v-for="(shelf, index) in shelves" :key="shelf['shelf_id']" :name="index">
              {{ shelf['shelf_name'] }}
            </at-dropdown-item>
          </at-dropdown-menu>
        </at-dropdown>
      </div>
    </div>
    <div class="table-wrapper" v-if="!isLoading">
      <at-table :columns="columns" :data="booksData" stripe>
        <!-- <at-checkbox-group v-model="checkboxValue4">

        </at-checkbox-group> -->
      </at-table>
    </div>
    <div class="loading" v-else>
      加载中……
    </div>
  </div>
</template>

<script>
// @ is an alias to /src
import GBWorker from 'worker-loader!../work/gb.work'

var worker

export default {
  name: 'home',
  components: {},
  created() {
    //获取本地用户信息
    var accountInfo = localStorage.getItem('accountInfo')
    if (accountInfo == null) {
      this.$router.push('/login')
      return
    }
    var accountJson = JSON.parse(accountInfo)
    var readInfo = accountJson.reader_info
    console.log(readInfo)
    this.readInfo = readInfo
    var avatarImage = readInfo.avatar_url
    this.loginToken = accountJson.login_token
    this.account = readInfo.account
    this.avatarImage = avatarImage

    //获取书架
    this.$get({
      url: '/bookshelf/get_shelf_list',
      //url: 'https://www.ciweimao.com/bookshelf/get_shelf_list',
      para: {
        login_token: this.loginToken,
        account: this.account
      }
    }).then(res => {
      console.log(res)
      this.shelves = res.shelf_list
      this.shelves.push({
        shelf_id: 'login',
        shelf_name: '切换账号'
      })
      this.currentShelf = this.shelves[0]
      let shelfId = this.currentShelf.shelf_id
      this.$get({
        url: '/bookshelf/get_shelf_book_list_new',
        para: {
          login_token: this.loginToken,
          account: this.account,
          count: 99999,
          shelf_id: shelfId,
          page: 0,
          order: 'last_read_time',
          //sort:'read'
        }
      }).then(res => {
        let books = res.book_list
        var data = books.sort(function(a, b) {  
                      var x = a.book_info.uptime.replace(/:/g, "").replace(/-/g, "").replace(" ", "")
                      var y = b.book_info.uptime.replace(/:/g, "").replace(/-/g, "").replace(" ", "")
                      return ((x>y)?-1:((x<y)?1:0));
                    });

        this.books = data //books
        let arr = []
        var book_index = 0
        books.forEach(book => {
          book_index++
          let obj = {
            name: book.book_info.book_name,
            author: book.book_info.author_name,
            date: book.book_info.last_chapter_info.uptime,
            index: book_index
          }
          arr.push(obj)
        })
        this.booksData = arr
        this.$nextTick(() => {
          this.isLoading = false
        })
        this.start_index = 0
        this.end_index = book_index
      })
    })
  },
  data() {
    return {
      loginToken: '',
      account: '',
      modal: false,
      avatarImage: '',
      shelfs: [],
      books: [],
      dlName: '',
      dlprogress: '',
      divisionNum: 0,
      chapterNum: 0,
      dlProgressText: '',
      timeoutText: '',
      dlButton: '',
      stopButton: '',
      canDl: false,
      dlUrl: '',
      timer1: null,
      timer2: null,
      second: 5,
      start_index: 0,
      end_index :0,
      columns: [
        {
          title: '序号',
          key: 'index'
        },
        // {
        //   title: '选择',
        //   key: 'checkbox'
        // },
        {
          title: '书名',
          key: 'name'
        },
        {
          title: '作者',
          key: 'author'
        },
        {
          title: '更新日期',
          key: 'date'
        },
        {
          title: '操作',
          render: (h, params) => {
            return h(
              'div',
              {
                style: {
                  display: 'flex'
                }
              },
              [
                h(
                  'div',
                  {
                    class: 'option-click go-detail',
                    on: {
                      click: () => this.goDetail(this.books[params['index']])
                    }
                  },
                  '详情'
                ),
                h(
                  'div',
                  {
                    class: 'option-click option-download',
                    style: {
                      marginLeft: '8px'
                    },
                    on: {
                      click: () => this.clickBook(this.books[params['index']])
                    }
                  },
                  '下载'
                )
              ]
            )
          }
        }
      ],
      booksData: [],
      readInfo: {},
      currentShelf: '',
      shelves: '',
      isLoading: true
    }
  },
  methods: {
    goLogin() {
      this.$router.push('/login')
    },
    goGit() {
      window.open('https://github.com/zsakvo/hbooker-extractor')
    },
    goDetail(book) {
      window.open('https://www.ciweimao.com/book/' + book['book_info']['book_id'])
    },
    switchShelf(index) {
      this.currentShelf = this.shelves[index]
      console.log(this.currentShelf)
      if (this.currentShelf['shelf_id'] === 'login') {
        this.goLogin()
      } else {
        this.isLoading = true
        this.$get({
          url: '/bookshelf/get_shelf_book_list_new',
          para: {
            login_token: this.loginToken,
            account: this.account,
            count: 99999,
            shelf_id: this.currentShelf['shelf_id'],
            page: 0,
            order: 'last_read_time'
          }
        }).then(res => {
          let books = res.book_list

          var data = books.sort(function(a, b) {  
                      var x = a.book_info.uptime.replace(/:/g, "").replace(/-/g, "").replace(" ", "")
                      var y = b.book_info.uptime.replace(/:/g, "").replace(/-/g, "").replace(" ", "")
                      return ((x>y)?-1:((x<y)?1:0));
                    });

          this.books = data
          let arr = []
          var book_index = 0
          books.forEach(book => {
            book_index++
            let obj = {
              name: book.book_info.book_name,
              author: book.book_info.author_name,
              date: book.book_info.last_chapter_info.uptime,
              index: book_index
            }
            arr.push(obj)
          })
          this.booksData = arr
          this.$nextTick(() => {
            this.isLoading = false
          })
          this.start_index = 0
          this.end_index = book_index
        })
      }
    },
    async clickBook(book) {
      let that = this
      that.canDl = false
      that.dlButton = '请稍后'
      that.stopButton = '停止'
      this.chapterNum = 0
      this.dlName = book.book_info.book_name
      that.chapterNum = 0
      that.dlProgressText = ''
      that.timeoutText = ''
      this.modal = true

      function startTimer1() {
        if (that.timer1 !== null) return
        console.log('startTimer1')
        that.timer1 = window.setInterval(() => {
          --that.second
          if (that.second === 0) {
            that.second = 10
            window.clearInterval(that.timer1)
            that.timer1 = null
            console.log('to be Timer1')
            worker.postMessage({
              cmd: 'stop',
              loginToken: that.loginToken,
              account: that.account
            })
          }
        }, 1000)
      }

      function stopTimer1() {
        if (that.timer1 !== null) {
          console.log('stopTimer1')
          that.second = 10
          window.clearInterval(that.timer1)
          that.timer1 = null
        }
      }

      function startTimer2() {
        if (that.timer2 !== null) return
        console.log('startTimer2')
        that.timer2 = window.setInterval(() => {
          --that.second
          if (that.second === 0) {
            that.second = 10
            window.clearInterval(that.timer2)
            that.timer2 = null
            console.log('to be Timer2')
            that.modal = false
          }
        }, 1000)
      }

      function stopTimer2() {
        if (that.timer2 !== null) {
          console.log('stopTimer2')
          that.second = 10
          window.clearInterval(that.timer2)
          that.timer2 = null
        }
      }

      //获取书籍 ID
      let bid = book.book_info.book_id
      //获取分卷 ID （全部）
      let divisionData = await this.getDivision(bid)
      this.divisionNum = divisionData.length
      //循环分卷，取出全部章节
      let allChapters = []
      for (var division of divisionData) {
        let divisionID = division.division_id
        let chapters = await this.getChapter(divisionID)
        allChapters.push(...chapters)
      }
      that.chapterNum = allChapters.length
      worker = new GBWorker()
      worker.postMessage({
        cmd: 'begin',
        loginToken: this.loginToken,
        account: this.account,
        para: allChapters
      })
      worker.onmessage = function(evt) {
        let msg = evt.data.msg
        let content = evt.data.content
        switch (msg) {
          case 'chapter_complete':
            {
              that.dlButton = '获取中'
              stopTimer1()
              stopTimer2()
              if (content > that.chapterNum / 2) {
                startTimer1()
              }
              that.dlProgressText = `${content}/${that.chapterNum}`
            }
            break
          case 'all_complete':
            stopTimer1()
            startTimer2()
            var blob = new Blob([content])
            that.dlUrl = URL.createObjectURL(blob)
            that.canDl = true
            that.dlButton = '下载到本地'
            that.dlBook()
            worker.terminate()
            break
        }
      }
    },
    async getDivision(bid) {
      return await this.$get({
        url: '/book/get_division_list',
        para: {
          login_token: this.loginToken,
          account: this.account,
          book_id: bid
        }
      }).then(res => {
        let divisionData = res.division_list
        return divisionData
      })
    },
    async getChapter(did) {
      var params = new URLSearchParams()
      params.append('last_update_time', 0)
      params.append('login_token', this.loginToken)
      params.append('account', this.account)
      params.append('division_id', did)
      params.append('app_version', '2.7.017')
      params.append('device_token', '282aae5d52978299134078ed2702ea16ddfbd20810d6fb019353c6014ad773e4')
      return await this.$post({
        url: '/chapter/get_updated_chapter_by_division_id',
        header: { 'Content-Type': 'application/x-www-form-urlencoded' },
        para: params
      }).then(res => {
        let chaptersData = res.chapter_list.map(l => {
          if (l['is_valid'] === '1') {
            return l
          }
        })
        console.log(chaptersData)
        return chaptersData
      })
    },
    dlBook() {
      var eleLink = document.createElement('a')
      eleLink.download = this.dlName + '.txt'
      eleLink.style.display = 'none'
      eleLink.href = this.dlUrl
      document.body.appendChild(eleLink)
      eleLink.click()
      document.body.removeChild(eleLink)
    },
    stopBook() {
      worker.postMessage({
        cmd: 'stop',
        loginToken: this.loginToken,
        account: this.account
      })
    },
    //下载所有选择的内容
    dlAllBook() {
      var eleLink = document.createElement('a')
      eleLink.download = this.dlName + '.txt'
      eleLink.style.display = 'none'
      eleLink.href = this.dlUrl
      document.body.appendChild(eleLink)
      eleLink.click()
      document.body.removeChild(eleLink)
    },
    setStartIndex (target) {
        // 输入的数据进行初始化，将非数字的替换为空
        //const val = target.value.toString().replace(/[^0-9]/ig,"")
        // 重新赋值
        //this.start_index = v.replace(/(\d{4})(?=\d)/g, '$1 ')
        this.start_index = target
    },
    setEndIndex (target) {
        // 输入的数据进行初始化，将非数字的替换为空
        //const val = target.value.toString().replace(/[^0-9]/ig,"")
        // 重新赋值
        //this.start_index = v.replace(/(\d{4})(?=\d)/g, '$1 ')
        this.end_index = target
    }
  }
}
</script>

<style lang="stylus" scoped>
.home{
  display flex
  flex-direction column
  .dl-info{
    white-space: pre-wrap;
  }
  .nav-wrapper{
    display flex
    height 64px
    justify-content space-between
    align-items center
    font-size 14px
    font-weight 600
    padding 0 36px
    position: fixed;
    background: #fff;
    width: 100%;
    z-index: 200;
    .title{
      cursor pointer
    }
  }
  .nav-download{
    display flex
    flex-wrap nowrap
    justify-content space-between
  }
  .no-books{
    padding-top 120px
    margin-left 48px
    font-size 14px
  }

  .table-wrapper{
    padding: 64px 32px
    >>>.option-click{
      cursor pointer
    }
  }

  .loading{
    padding 64px 32px
    height 80vh
  }
}
</style>
