import axios from "axios";
import decrypt from "../plugins/decrypt";
const mixin = {
  baseUrl: "/api", //url前缀
  standardFlag: true,
  timeout: 15000,
  withCredentials: false //跨域请求是否使用凭证
};
const para = {
  app_version: "2.3.020",
  device_token: "ciweimao_powered_by_zsakvo_with_vue"
};
var loginToken;
var account;
var book = "";
var chapterNum = 0;
// 响应父线程的消息
self.addEventListener("message", async event => {
  let cmd = event.data.cmd;
  let para = event.data.para;
  loginToken = event.data.loginToken;
  account = event.data.account;
  switch (cmd) {
    case "begin":
      for (var chapter of para) {
        let cid = chapter.chapter_id;
        let key = await getChapterKey(cid);
        let content = await getChapterContent(cid, key);
        let chapterInfo = content.chapter_info;
        if (Object.keys(chapterInfo).length != 0) {
          let contentTitle = chapterInfo.chapter_title;
          let contentText = chapterInfo.txt_content;
          let decryptContent = decrypt(contentText, key);
          book += contentTitle + "\n" + decryptContent + "\n\n\n";
        }
        chapterNum++;
        self.postMessage({ msg: "chapter_complete", content: chapterNum });
      }
      self.postMessage({ msg: "all_complete", content: book });
      break;
  }
});

var getChapterKey = async function(cid) {
  return await get({
    url: "/chapter/get_chapter_cmd",
    para: {
      login_token: loginToken,
      account: account,
      chapter_id: cid
    }
  }).then(res => {
    return res.command;
  });
};

var getChapterContent = async function(cid, key) {
  return await get({
    url: "/chapter/get_cpt_ifm",
    para: {
      login_token: loginToken,
      account: account,
      chapter_id: cid,
      chapter_command: key
    }
  }).then(res => {
    return res;
  });
};

var get = function(options) {
  let params = Object.assign({}, para, options.para);
  return new Promise((resolve, reject) => {
    axios
      .get(mixin.baseUrl + options.url, {
        params: params
      })
      .then(response => {
        let data = decrypt(response.data.trim());
        var lastIndex = data.lastIndexOf("}");
        data = data.substr(0, lastIndex + 1);
        let json = JSON.parse(data);
        switch (json.code) {
          case 100000:
            resolve(json.data);
            break;
          default:
        }
      })
      .catch(err => {
        reject(err);
      });
  });
};
