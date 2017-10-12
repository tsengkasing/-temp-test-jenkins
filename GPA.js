/**
 * Created by tsengkasing on 4/25/2017.
 */
const http = require('http');
const md5 = require('md5');
const querystring = require('querystring');
const iconv = require("iconv-lite");
const minify = require('html-minifier').minify;
const { JSDOM } = require("jsdom");

const parsecode = require('./parseCAPTCHA');

let store = {};

/*
    主函数
    按照流程访问xuanke.tongji.edu.cn
    获取cookie
    验证用户名和密码
    验证验证码
    获取绩点页面
    解析绩点页面
    返回JSON对象
    调用回调函数
*/
function GPA(token, cb = function(){}) {
    const {token1, token2} = token;

    requestLoginPage().then(()=>{
        return requestVerificationCode();
    }).then((obj)=>{
        return parseVerificationCode(obj);
    }).then((code) => {
        return requestToLogin({token1, token2, code});
    }).then(() => {
        return requestLoginCheckCode();
    }).then(() => {
        return requestToHome();
    }).then(() => {
        return requestBeforeGetGPA();
    }).then(() => {
        return requestGetGPA();
    }).then((html) => {
        cb(parseGPA(html));
    }).catch((message) => {
        console.error(message);
        cb(null);
    });
}

//访问页面，获取cookie
function requestLoginPage() {
    const opts = {
        hostname: "xuanke.tongji.edu.cn",
        method: 'GET',
        port: 80,
        headers: {
            'Accept': 'text/html, application/xhtml+xml, image/jxr, */*',
            'Accept-Encoding': 'gzip, deflate',
            'Accept-Language': 'en-US, en; q=0.8, zh-Hans-CN; q=0.5, zh-Hans; q=0.3',
            'Connection': 'keep-alive',
            'Host': 'xuanke.tongji.edu.cn',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/52.0.2743.116 Safari/537.36 Edge/15.15063'
        }
    };

    return new Promise((resolve, reject)=>{
        let req = http.request(opts, (res) => {
            let info = [];
            res.on('data', (chunk) => info.push(chunk));
            res.on('end', () => {
                store.cookie = res.headers['set-cookie'].join('').split(';')[0];
                resolve();
            })
        });

        req.on('error', (e) => {
            console.error(e.message + '...');
            reject('连不上xuanke网了呢~');
        });

        req.setTimeout(10000, () => {
            reject('连不上xuanke网了呢~');
        });

        req.end();
    });
}

//使用cookie，获取验证码
function requestVerificationCode() {
    const opts = {
        hostname: "xuanke.tongji.edu.cn",
        path: "/CheckImage",
        method: 'GET',
        port: 80,
        headers: {
            'Accept': 'image/png, image/svg+xml, image/jxr, image/*; q=0.8, */*; q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'Accept-Language': 'en-US, en; q=0.8, zh-Hans-CN; q=0.5, zh-Hans; q=0.3',
            'Cookie': store.cookie ,
            'Connection': 'keep-alive',
            'Host': 'xuanke.tongji.edu.cn',
            'Referer': 'http://xuanke.tongji.edu.cn/index.jsp',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/52.0.2743.116 Safari/537.36 Edge/15.15063'
        }
    };
    return new Promise((resolve) => {
        let req = http.request(opts, (res) => {
            let info = [];
            res.on('data', (chunk) => info.push(chunk));
            res.on('end', () => {
                if(!info) return;
                info = Buffer.concat(info);
                resolve(info);
            })
        });

        req.on('error', (e) => {
            console.error(e.message);
        });

        req.end();
    });
}

//使用神经网络解析验证码
function parseVerificationCode(image_buffer) {
    return new Promise((resolve) => {
        parsecode(image_buffer, (code) => {
            store.code = code;
            resolve(code);
        });
    });
}

//发送用户名和密码，判断正确与否
function requestToLogin(input) {
    let {token1, token2, code} = input;
    const opts = {
        hostname: "tjis2.tongji.edu.cn",
        path: "/amserver/UI/Login",
        method: 'POST',
        port: 58080,
        headers: {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Encoding': 'gzip, deflate',
            'Accept-Language': 'en-US,en;q=0.8,zh-CN;q=0.6,zh;q=0.4',
            'cache-control': 'no-cache',
            'Connection': 'keep-alive',
            'Content-Type': 'application/x-www-form-urlencoded',
            'DNT': 1,
            'Host': 'tjis2.tongji.edu.cn:58080',
            'Pragma': 'no-cache',
            'Referer': 'http://xuanke.tongji.edu.cn/index.jsp',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/52.0.2743.116 Safari/537.36 Edge/15.15063'
        }
    };
    const requestBody = {
        'goto': `http://xuanke.tongji.edu.cn/pass.jsp?checkCode=${code}`,
        'gotoOnFail': `http://xuanke.tongji.edu.cn/deny.jsp?checkCode=${code}&account=${token1}&password=${md5(token2)}`,
        'Login.Token1': token1,
        'Login.Token2': token2,
        'T3': code
    };
    return new Promise((resolve, reject) => {
        let req = http.request(opts, (res) => {
            let info = [];
            res.on('data', (chunk) => info.push(chunk));
            res.on('end', () => {
                let cookies = res.headers['set-cookie'];
                let _cookie = `${store.cookie};`;
                for(let cookie_item of cookies) {
                    _cookie += `${cookie_item.split(';')[0]};`;
                }
                store.cookie = _cookie;


                //登录失败
                if(/deny.jsp/.test(res.headers.location)) {
                    reject('Incorrect username or password.');
                }

                //登录成功
                resolve();
            })
        });

        req.on('error', (e) => {
            console.error(e.message);
        });
        req.write(querystring.stringify(requestBody));
        req.end();
    });
}

//验证验证码是否正确
function requestLoginCheckCode() {
    const opts = {
        hostname: 'xuanke.tongji.edu.cn',
        path: `/pass.jsp?checkCode=${store.code}`,
        method: 'GET',
        port: 80,
        headers: {
            'Accept': 'text/html, application/xhtml+xml, image/jxr, */*',
            'Accept-Encoding': 'gzip, deflate',
            'Accept-Language': 'en-US, en; q=0.8, zh-Hans-CN; q=0.5, zh-Hans; q=0.3',
            'Cookie': store.cookie,
            'Connection': 'keep-alive',
            'Content-Type': 'application/x-www-form-urlencoded',
            'Host': 'xuanke.tongji.edu.cn',
            'Referer': 'http://xuanke.tongji.edu.cn/index.jsp',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/52.0.2743.116 Safari/537.36 Edge/15.15063'
        }
    };
    return new Promise((resolve, reject) => {
        let req = http.request(opts, (res) => {
            let info = [];
            res.on('data', (chunk) => info.push(chunk));
            res.on('end', () => {
                if(!info) return;
                info = Buffer.concat(info);

                //验证码错误
                if(/index.jsp/.test(res.headers.location)) {
                    debugger;
                    reject('Incorrect verification code.');
                }

                resolve();
            })
        });

        req.on('error', (e) => {
            console.error(e.message);
        });

        req.end();
    });
}

//登录到主页面
function requestToHome() {
    const opts = {
        hostname: 'xuanke.tongji.edu.cn',
        path: '/tj_login/frame.jsp',
        method: 'GET',
        port: 80,
        headers: {
            'Accept': 'text/html, application/xhtml+xml, image/jxr, */*',
            'Accept-Encoding': 'gzip, deflate',
            'Accept-Language': 'en-US, en; q=0.8, zh-Hans-CN; q=0.5, zh-Hans; q=0.3',
            'Cookie': store.cookie,
            'Connection': 'keep-alive',
            'Content-Type': 'application/x-www-form-urlencoded',
            'Host': 'xuanke.tongji.edu.cn',
            'Referer': 'http://xuanke.tongji.edu.cn',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/52.0.2743.116 Safari/537.36 Edge/15.15063'
        }
    };

    return new Promise((resolve) => {

        let req = http.request(opts, (res) => {
            let info = [];
            res.on('data', (chunk) => info.push(chunk));
            res.on('end', () => {
                if(!info) return;
                info = Buffer.concat(info);
                resolve();
            })
        });

        req.on('error', (e) => {
            console.error(e.message);
        });

        req.end();
    });
}

//获取绩点页面权限
function requestBeforeGetGPA() {
    const opts = {
        hostname: 'xuanke.tongji.edu.cn',
        path: '/tj_login/redirect.jsp?link=/tj_xuankexjgl/score/query/student/cjcx.jsp?qxid=20051013779916$mkid=20051013779901&qxid=20051013779916&HELP_URL=null&MYXSJL=null',
        method: 'GET',
        port: 80,
        headers: {
            'Accept': 'text/html, application/xhtml+xml, image/jxr, */*',
            'Accept-Encoding': 'gzip, deflate',
            'Accept-Language': 'en-US, en; q=0.8, zh-Hans-CN; q=0.5, zh-Hans; q=0.3',
            'Cookie': store.cookie,
            'Connection': 'keep-alive',
            'Host': 'xuanke.tongji.edu.cn',
            'Referer': 'http://xuanke.tongji.edu.cn/tj_login/frame.jsp',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/52.0.2743.116 Safari/537.36 Edge/15.15063'
        }
    };

    return new Promise((resolve) => {
        let req = http.request(opts, (res) => {
            let info = [];
            res.on('data', (chunk) => info.push(chunk));
            res.on('end', () => {
                if(!info) return;
                info = Buffer.concat(info);
                resolve();
            })
        });

        req.on('error', (e) => {
            console.error(e.message);
        });

        req.end();
    });
}

//获取绩点页面
function requestGetGPA() {
    const opts = {
        hostname: 'xuanke.tongji.edu.cn',
        path: '/tj_xuankexjgl/score/query/student/cjcx.jsp?qxid=20051013779916&mkid=20051013779901',
        method: 'GET',
        port: 80,
        headers: {
            'Accept': 'text/html, application/xhtml+xml, image/jxr, */*',
            'Accept-Encoding': 'gzip, deflate',
            'Accept-Language': 'en-US, en; q=0.8, zh-Hans-CN; q=0.5, zh-Hans; q=0.3',
            'Cookie': store.cookie,
            'Connection': 'keep-alive',
            'Host': 'xuanke.tongji.edu.cn',
            'Referer': 'http://xuanke.tongji.edu.cn/tj_login/frame.jsp',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/52.0.2743.116 Safari/537.36 Edge/15.15063'
        }
    };

    return new Promise((resolve) => {
        let req = http.request(opts, (res) => {
            let info = [];
            res.on('data', (chunk) => info.push(chunk));
            res.on('end', () => {
                if(!info) return;
                info = Buffer.concat(info);
                //转换字母编码
                info = iconv.decode(info, 'gb2312');
                //压缩HTML去掉换行
                info = minify(info, {
                    minifyJS: true,
                    collapseWhitespace: true,
                    removeComments: true
                });
                resolve(info);
            })
        });

        req.on('error', (e) => {
            console.error(e.message);
        });

        req.end();
    });
}

//获取绩点
function parseGPA(html) {
    try {
        const document = new JSDOM(html).window.document;
        let table = document.querySelector('#T1').firstElementChild;

        let line_info = table.firstElementChild.firstElementChild.firstElementChild;
        let line_credit = table.childNodes[1].firstElementChild;
        let _GPA = {
            matriculation_number: line_info.childNodes[3].wholeText.trim(),
            name: line_info.childNodes[5].wholeText.trim(),
            college: line_info.childNodes[7].wholeText.trim(),
            major: line_info.childNodes[9].wholeText.trim(),

            gpa: line_credit.childNodes[1].innerHTML.trim(),
            selective_credit: line_credit.childNodes[3].innerHTML.trim(),
            actual_credit: line_credit.childNodes[5].innerHTML.trim(),
            fail_courses_count: line_credit.childNodes[7].innerHTML.trim(),

            table: []
        };

        let semesters = table.querySelectorAll('td[colspan="9"] div[align="center"]');

        for(let semester of semesters) {
            let GPA_semester = {
                semester: null,
                course_list: null,
                GPA: null
            };
            GPA_semester.semester = semester.innerHTML;

            let GPA_course_node = semester.parentNode.parentNode.nextSibling.nextSibling;
            GPA_semester.course_list = [];
            while(GPA_course_node.firstElementChild.getAttribute('colspan') === null) {
                let GPA_course = [];
                for(let text_node of GPA_course_node.childNodes) {
                    let text = text_node.firstElementChild.firstElementChild.innerHTML;
                    GPA_course.push(text);
                }
                GPA_semester.course_list.push(GPA_course);
                GPA_course_node = GPA_course_node.nextSibling;
            }
            GPA_semester.GPA = GPA_course_node.firstElementChild.firstElementChild.innerHTML;

            _GPA.table.push(GPA_semester);
        }

        return JSON.stringify(_GPA);
    }catch (e) {
        console.error('Parse HTML Failed.');
        return null;
    }
}

module.exports = GPA;