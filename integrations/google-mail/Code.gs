// Deploy as the selected owner, accessible to Anyone. Only signed invitation requests can send mail.
const CLASSROOM_URL = 'https://classroom-drawer-6-20261113.asdad123asd.chatgpt.site/?view=shared';

function initializeMailer() {
  const properties = PropertiesService.getScriptProperties();
  if (!properties.getProperty('MAIL_SECRET')) properties.setProperty('MAIL_SECRET', Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, ''));
  const sender = Session.getEffectiveUser().getEmail();
  if (!sender) throw new Error('발신 계정을 확인하지 못했습니다.');
  MailApp.getRemainingDailyQuota(); // Request send-mail permission during setup, never send a setup message.
  console.log(JSON.stringify({sender: sender, status: 'ready'}));
}

function doGet() {
  return mailResponse_({service: '수업서랍 초대 메일', status: 'ready'});
}

function doPost(event) {
  try {
    const raw = event && event.postData && event.postData.contents;
    if (!raw || raw.length > 4096) return mailResponse_({status: 'failed', code: 'invalid_request'});
    const envelope = JSON.parse(raw);
    const secret = PropertiesService.getScriptProperties().getProperty('MAIL_SECRET');
    if (!secret || typeof envelope.payload !== 'string' || !/^[a-f0-9]{64}$/.test(envelope.signature || '')) return mailResponse_({status: 'failed', code: 'authorization'});
    const signed = Utilities.computeHmacSha256Signature(envelope.payload, secret, Utilities.Charset.UTF_8).map(function(byte) {return ('0' + ((byte + 256) % 256).toString(16)).slice(-2);}).join('');
    let difference = 0;
    for (let i = 0; i < signed.length; i++) difference |= signed.charCodeAt(i) ^ envelope.signature.charCodeAt(i);
    if (difference) return mailResponse_({status: 'failed', code: 'authorization'});
    const request = JSON.parse(envelope.payload);
    if (!/^[a-f0-9-]{36}$/.test(request.id || '') || typeof request.email !== 'string' || request.email.length > 254 || !/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(request.email) || typeof request.timestamp !== 'number' || Math.abs(Date.now() - request.timestamp) > 300000) return mailResponse_({status: 'failed', code: 'invalid_request'});
    const message = mailMessage_(request);
    if (!message) return mailResponse_({status: 'failed', code: 'invalid_request'});
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(5000)) return mailResponse_({status: 'unknown', code: 'busy'});
    try {
      const properties = PropertiesService.getScriptProperties(), key = 'delivery:' + request.id;
      const saved = properties.getProperty(key);
      if (saved) {
        const previous = JSON.parse(saved);
        if (previous.email !== request.email) return mailResponse_({status: 'failed', code: 'invalid_request'});
        return mailResponse_({status: previous.status === 'sent' ? 'sent' : 'unknown'});
      }
      if (MailApp.getRemainingDailyQuota() < 1) return mailResponse_({status: 'failed', code: 'quota'});
      const entry = {email: request.email, status: 'sending', at: new Date().toISOString()};
      properties.setProperty(key, JSON.stringify(entry));
      try {
        MailApp.sendEmail({to: request.email, name: '수업서랍', subject: message.subject, body: message.body, htmlBody: message.htmlBody});
        entry.status = 'sent';
        properties.setProperty(key, JSON.stringify(entry));
        return mailResponse_({status: 'sent'});
      } catch (error) {
        // Sending may have completed before an exception. Never replay this ID blindly.
        return mailResponse_({status: 'unknown'});
      }
    } finally {lock.releaseLock();}
  } catch (error) {return mailResponse_({status: 'failed', code: 'invalid_request'});}
}

function mailResponse_(value) {return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);}
function escapeHtml_(value) {return value.replace(/[&<>"']/g, function(character) {return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character];});}

function mailMessage_(request) {
  const login = request.kind === 'login';
  if (request.kind && !login) return null;
  let appUrl = request.appUrl, destination = CLASSROOM_URL;
  if (appUrl) {
    if (typeof appUrl !== 'string' || !/^https:\/\/[a-z0-9.-]+(?::[0-9]+)?\/?$/i.test(appUrl)) return null;
    appUrl = appUrl.replace(/\/$/, '');
    destination = appUrl + '/?view=shared';
  }
  if (login) {
    if (!appUrl || typeof request.loginUrl !== 'string' || request.loginUrl.length > 2000 || request.loginUrl.indexOf(appUrl + '/api/auth/magic-link/verify?') !== 0) return null;
    destination = request.loginUrl;
  }
  const heading = login ? '수업서랍 로그인' : '수업서랍에 초대합니다';
  const detail = login ? '아래 버튼으로 로그인해 주세요. 링크는 10분 동안 한 번만 사용할 수 있습니다.' : '동료 교사와 수업 아이디어를 함께 모으는 공간에 초대했어요. 초대받은 이메일로 로그인 링크를 받아 주세요.';
  const label = login ? '수업서랍 로그인' : '수업서랍 열기';
  const escaped = escapeHtml_(destination);
  return {subject: login ? '[수업서랍] 로그인 링크' : '[수업서랍] 동료 교사 초대가 도착했어요',
    body: heading + '\n\n' + request.email + '\n' + detail + '\n\n' + label + ': ' + destination + '\n\n요청하지 않으셨다면 이 메일을 무시해 주세요.',
    htmlBody: '<div style="font-family:Arial,sans-serif;color:#283c35;line-height:1.8;max-width:580px;margin:auto;padding:32px"><h1 style="font-size:24px;color:#216b58">' + heading + '</h1><p>' + escapeHtml_(request.email) + '</p><p>' + detail + '</p><p style="margin:28px 0"><a href="' + escaped + '" style="background:#216b58;color:white;text-decoration:none;padding:13px 22px;border-radius:9px;display:inline-block">' + label + '</a></p><p style="font-size:12px;color:#74856c">요청하지 않으셨다면 이 메일을 무시해 주세요.</p></div>'};
}
