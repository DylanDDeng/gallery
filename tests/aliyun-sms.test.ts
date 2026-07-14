import assert from "node:assert/strict";
import test from "node:test";
import {
  AliyunSmsUnknownResultError,
  buildAliyunSmsRequest,
  sendAliyunSms,
  type AliyunSmsConfig,
} from "../src/lib/aliyun-sms.ts";

const config: AliyunSmsConfig = {
  accessKeyId: "test-key-id",
  accessKeySecret: "test-key-secret",
  region: "cn-hangzhou",
  signName: "Aestara",
  templateCode: "SMS_123",
  templateParam: "code",
  timeoutMs: 50,
};

test("builds a signed Alibaba Cloud RPC request without exposing the secret", () => {
  const request = buildAliyunSmsRequest(
    config,
    "+8613800138000",
    "123456",
    new Date("2026-07-14T12:00:00.000Z"),
    "fixed-nonce",
  );
  const parameters = new URLSearchParams(request.body);

  assert.equal(request.url, "https://dysmsapi.aliyuncs.com/");
  assert.equal(parameters.get("PhoneNumbers"), "13800138000");
  assert.equal(parameters.get("TemplateParam"), JSON.stringify({ code: "123456" }));
  assert.equal(parameters.get("SignatureNonce"), "fixed-nonce");
  assert.ok(parameters.get("Signature"));
  assert.equal(request.body.includes(config.accessKeySecret), false);
});

test("accepts only Alibaba Cloud Code OK as successful delivery", async () => {
  const ok = await sendAliyunSms(config, "+8613800138000", "123456", async () =>
    new Response(JSON.stringify({ Code: "OK", RequestId: "req-1", BizId: "biz-1" }), {
      status: 200,
    }),
  );
  assert.deepEqual(ok, {
    ok: true,
    code: "OK",
    requestId: "req-1",
    bizId: "biz-1",
  });

  const rejected = await sendAliyunSms(config, "+8613800138000", "123456", async () =>
    new Response(JSON.stringify({ Code: "isv.BUSINESS_LIMIT_CONTROL", Message: "limited" }), {
      status: 200,
    }),
  );
  assert.equal(rejected.ok, false);
  assert.equal(rejected.code, "isv.BUSINESS_LIMIT_CONTROL");
});

test("classifies network failures as unknown provider results", async () => {
  await assert.rejects(
    sendAliyunSms(config, "+8613800138000", "123456", async () => {
      throw new Error("timeout");
    }),
    AliyunSmsUnknownResultError,
  );
});
