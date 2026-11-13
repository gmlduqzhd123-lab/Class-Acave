// Deploy as the selected owner, accessible to Anyone. Only signed invitation requests can send mail.
const CLASSROOM_URL = 'https://classroom-drawer-6-20261113.asdad123asd.chatgpt.site/?view=shared';

function initializeMailer() {
  const properties = PropertiesService.getScriptProperties();
  if (!properties.getProperty('MAIL_SECRET')) properties.setProperty('MAIL_SECRET', Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, ''));
  const sender = Session.getEffectiveUser().getEmail();
  if (!sender) throw new Error('발신 계정을 확인하지 못했습니다.');
  MailApp.getRemainingDailyQuota(); // Request send-mail permission during setup, never send a setup message.
  console.log(JSON.stringify({sender: sender, secret: properties.getProperty('MAIL_SECRET')}));
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
        const email = escapeHtml_(request.email);
        MailApp.sendEmail({
          to: request.email,
          subject: '[수업서랍] 동료 교사 초대가 도착했어요',
          name: '수업서랍',
          body: '수업서랍에 초대합니다.\n\n' + request.email + ' 계정으로 ChatGPT 로그인하면 함께 사용할 수 있습니다.\n공용 수업 자료를 검색하고, 동료의 자료 모음을 읽거나 내 모음으로 복사해 보세요.\n개인 모음과 준비 메모는 비공개로 보관됩니다.\n\n수업서랍 열기: ' + CLASSROOM_URL + '\n\n초대를 요청하지 않으셨다면 이 메일을 무시하셔도 됩니다.',
          htmlBody: '<div style="font-family:Arial,sans-serif;color:#283c35;line-height:1.8;max-width:580px;margin:auto;padding:32px"><h1 style="font-size:24px;color:#216b58">수업서랍에 초대합니다</h1><p>동료 교사와 수업 아이디어를 함께 모으는 공간에 초대했어요.</p><p><strong>' + email + '</strong> 계정으로 ChatGPT 로그인해 주세요.</p><p>공용 수업 자료를 검색하고, 동료의 자료 모음을 읽거나 내 모음으로 복사할 수 있습니다. 개인 모음과 준비 메모는 비공개로 보관됩니다.</p><p style="margin:28px 0"><a href="' + CLASSROOM_URL + '" style="background:#216b58;color:white;text-decoration:none;padding:13px 22px;border-radius:9px;display:inline-block">수업서랍 열기</a></p><p style="font-size:12px;color:#74856c">버튼이 열리지 않으면 아래 주소를 복사해 주세요.<br><a href="' + CLASSROOM_URL + '">' + CLASSROOM_URL + '</a></p><p style="font-size:12px;color:#74856c">초대를 요청하지 않으셨다면 이 메일을 무시하셔도 됩니다.</p></div>'
        });
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
