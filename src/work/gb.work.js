import axios from 'axios'
import decrypt from '../plugins/decrypt'
const mixin = {
  baseUrl: '/api', //url前缀
  standardFlag: true,
  timeout: 15000,
  withCredentials: false //跨域请求是否使用凭证
}
const para = {
  app_version: '2.7.017',
  device_token: '282aae5d52978299134078ed2702ea16ddfbd20810d6fb019353c6014ad773e4'
}
var loginToken
var account
var book = ''
var bookOutOfOrder = []
var chapterNum = 0
//var firstNum = 0
var chapterLength = 0

//function setChapterNum(num) {
//  this.chapterNum = this.chapterNum + num;
//}

// 响应父线程的消息
self.addEventListener('message', async event => {
  let cmd = event.data.cmd
  let para = event.data.para
  loginToken = event.data.loginToken
  account = event.data.account
  switch (cmd) {
    case 'begin':
      {
        for (let i = 0; i < para.length; i++) {
          const chapter = para[i]
          getChapter(chapter, i, para.length)
        }
        chapterLength = para.length
      }
      break
    case 'stop':
      {
        for (let ii = 0; ii < chapterLength; ii++) {
          book += bookOutOfOrder[ii]
        }
        self.postMessage({ msg: 'all_complete', content: book })
      }
      break
  }
})

var getChapter = async function(chapter, i, length) {
  try {
    if ((chapter.is_valid !== 0) && (chapter.auth_access !== 0))
    {
      let key = await getChapterKey(chapter.chapter_id)
      let content = await getChapterContent(chapter.chapter_id, key)
      let chapterInfo = content.chapter_info
      if (Object.keys(chapterInfo).length != 0) {
        let contentTitle = chapterInfo.chapter_title
        let contentText = chapterInfo.txt_content
        let decryptContent = decrypt(contentText, key)
        bookOutOfOrder[i] = contentTitle + '\n' + decryptContent + '\n\n\n'
      } else {
        //throw new Error('Failed to get chapter info')
      }
    }
    else
    {
      if (chapter.auth_access === 0)
      {
        bookOutOfOrder[i] = '\n' + chapter.chapter_title + ' 章节未付费\n\n'
      }
      else if (chapter.is_valid === 0)
      {
        bookOutOfOrder[i] = '\n' + chapter.chapter_title + ' 章节被屏蔽\n\n'
      }
    }
  } catch (e) {
    bookOutOfOrder[i] = '\n章节读取失败\n\n'
    console.error(e + ' download failed:' + chapterNum + '\n')
    // if (firstNum === 0) {
    //   firstNum = 1
    //   chapterNum++
    // }
  } finally {
    chapterNum++
    self.postMessage({ msg: 'chapter_complete', content: chapterNum })
    if (chapterNum === length) {
      for (let ii = 0; ii < length; ii++) {
        book += bookOutOfOrder[ii]
      }
      self.postMessage({ msg: 'all_complete', content: book })
    }
  }
}

var getChapterKey = async function(cid) {
  return await get({
    url: '/chapter/get_chapter_cmd',
    para: {
      login_token: loginToken,
      account: account,
      chapter_id: cid
    }
  }).then(res => {
    return res.command
  })
}

var getChapterContent = async function(cid, key) {
  return await get({
    url: '/chapter/get_cpt_ifm',
    para: {
      login_token: loginToken,
      account: account,
      chapter_id: cid,
      chapter_command: key
    }
  }).then(res => {
    return res
  })
}

var get = function(options) {
  let params = Object.assign({}, para, options.para)
  return new Promise((resolve, reject) => {
    axios
      .get(mixin.baseUrl + options.url, {
        params: params
      })
      .then(response => {
        let data = decrypt(response.data.trim())
        var lastIndex = data.lastIndexOf('}')
        data = data.substr(0, lastIndex + 1)
        let json = JSON.parse(data)
        switch (json.code) {
          case 100000:
            resolve(json.data)
            break
          default:
        }
      })
      .catch(err => {
        reject(err)
      })
  })
}
