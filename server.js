// Telegram-бот для продажи гайда «Как решить любой вопрос через систему за 30 дней»
// Хостинг: Deno Deploy (free). Работает через webhook.
// Файл: server.js

const TOKEN = "8753884578:AAHXVM-yT7Nqp7d_QvFhn3-wNUF8ZuMyNi4"; // токен бота
const ADMIN_ID = 1564548420; // ваш Telegram ID
const PRICE = "990 ₽";
// Ссылка на PDF гайда в вашем GitHub-репозитории (замените ВАШ_ЛОГИН на ваш GitHub-логин!)
const PDF_URL = "https://raw.githubusercontent.com/Vadimkill88/vadim-guide-bot/main/guide.pdf";
const API = "https://api.telegram.org/bot" + TOKEN;

const PAYMENT_TEXT =
  "Оплата: перевод по СБП на номер +7 927 961 9200\n" +
  "Получатель: Вадим Кильчурин\n\n" +
  "После оплаты нажмите кнопку «Я оплатил» — я проверю и сразу отправлю гайд.";

const WELCOME =
  "Здравствуйте! Это бот Вадима Кильчурина.\n\n" +
  "📘 Гайд «Как решить любой вопрос через систему за 30 дней»:\n" +
  "• 13 лет опыта в системе (от начальника отдела ЖКХ до главы поселения)\n" +
  "• 6 готовых шаблонов жалоб и заявлений\n" +
  "• Пошаговый план и чек-лист на 30 дней\n" +
  "• Результат: ответ и решение вашего вопроса — вместо тишины\n\n" +
  "Стоимость: " + PRICE;

async function tg(method, payload) {
  try {
    const r = await fetch(API + "/" + method, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return await r.json();
  } catch (e) {
    return null;
  }
}

async function sendText(chatId, text, buttons) {
  const payload = { chat_id: chatId, text: text };
  if (buttons) {
    payload.reply_markup = {
      inline_keyboard: buttons.map((row) =>
        row.map(([t, c]) => ({ text: t, callback_data: c }))
      ),
    };
  }
  return tg("sendMessage", payload);
}

async function sendPdf(chatId) {
  try {
    // Скачиваем PDF из GitHub-репозитория
    const pdfResp = await fetch(PDF_URL);
    if (!pdfResp.ok) throw new Error("PDF fetch failed: " + pdfResp.status);
    const pdfBlob = await pdfResp.blob();
    // Отправляем в Telegram как документ
    const form = new FormData();
    form.append("chat_id", chatId);
    form.append("caption", "Ваш гайд. Спасибо за покупку!");
    form.append("document", pdfBlob, "guide.pdf");
    const r = await fetch(API + "/sendDocument", { method: "POST", body: form });
    return await r.json();
  } catch (e) {
    await sendText(chatId, "Не удалось отправить файл. Напишите автору: @VadimKILL");
    return null;
  }
}

async function handleUpdate(update) {
  // Текстовые сообщения
  if (update.message) {
    const chatId = update.message.chat.id;
    await sendText(chatId, WELCOME, [[["Купить гайд за " + PRICE, "buy"]]]);
  }

  // Нажатия на кнопки
  if (update.callback_query) {
    const cb = update.callback_query;
    const chatId = cb.message.chat.id;
    const data = cb.data || "";
    await tg("answerCallbackQuery", { callback_query_id: cb.id });

    if (data === "buy") {
      await sendText(chatId, PAYMENT_TEXT, [[["Я оплатил", "paid"]]]);
    } else if (data === "paid") {
      await sendText(
        ADMIN_ID,
        "💳 Покупатель (id " + chatId + ") сообщил об оплате.\nПроверьте поступление и подтвердите.",
        [[["✅ Подтвердить", "confirm:" + chatId], ["❌ Отклонить", "reject:" + chatId]]]
      );
      await sendText(chatId, "Спасибо! Я уведомил автора. Как только он подтвердит оплату — сразу отправлю гайд.");
    } else if (data.startsWith("confirm:")) {
      const buyer = parseInt(data.split(":")[1], 10);
      await sendPdf(buyer);
      await sendText(chatId, "Гайд отправлен покупателю.");
    } else if (data.startsWith("reject:")) {
      const buyer = parseInt(data.split(":")[1], 10);
      await sendText(buyer, "Оплата не подтверждена. Если вы оплатили — напишите автору: @VadimKILL");
      await sendText(chatId, "Отклонено.");
    }
  }
}

Deno.serve(async (req) => {
  const url = new URL(req.url);

  // Webhook от Telegram
  if (url.pathname === "/webhook" && req.method === "POST") {
    try {
      const update = await req.json();
      await handleUpdate(update);
    } catch (e) {
      console.error("Webhook error:", e);
    }
    return new Response("ok");
  }

  // Однократный запуск: подключает webhook. Откройте в браузере после деплоя.
  if (url.pathname === "/setup") {
    const webhookUrl = "https://" + req.headers.get("host") + "/webhook";
    try {
      const r = await fetch(API + "/setWebhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: webhookUrl }),
      });
      const j = await r.json();
      return new Response("setWebhook -> " + r.status + " " + JSON.stringify(j));
    } catch (e) {
      return new Response("Ошибка: " + e.message);
    }
  }

  return new Response("Bot is running");
});