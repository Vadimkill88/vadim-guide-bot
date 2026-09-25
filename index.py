# -*- coding: utf-8 -*-
# Telegram-бот для продажи гайда «Как решить любой вопрос через систему за 30 дней»
# Хостинг: Koyeb (free). Работает через webhook.
# Файл: index.py

import json
import os
import requests
from flask import Flask, request

app = Flask(__name__)

# ===== НАСТРОЙКИ =====
TOKEN = "8753884578:AAHXVM-yT7Nqp7d_QvFhn3-wNUF8ZuMyNi4"  # токен бота
ADMIN_ID = 1564548420                            # ваш Telegram ID
PDF_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "guide.pdf")
PRICE = "990 ₽"
PAYMENT_TEXT = (
    "Оплата: перевод по СБП на номер +7 927 961 9200\n"
    "Получатель: Вадим Кильчурин\n\n"
    "После оплаты нажмите кнопку «Я оплатил» — я проверю и сразу отправлю гайд."
)
# =====================

API = "https://api.telegram.org/bot" + TOKEN


def tg(method, **kwargs):
    try:
        return requests.post(API + "/" + method, json=kwargs, timeout=30)
    except Exception:
        return None


def send_text(chat_id, text, buttons=None):
    payload = {"chat_id": chat_id, "text": text}
    if buttons:
        payload["reply_markup"] = json.dumps(
            {"inline_keyboard": [[{"text": t, "callback_data": c} for t, c in row] for row in buttons]}
        )
    tg("sendMessage", **payload)


def send_pdf(chat_id):
    try:
        with open(PDF_PATH, "rb") as f:
            requests.post(
                API + "/sendDocument",
                data={"chat_id": chat_id, "caption": "Ваш гайд. Спасибо за покупку!"},
                files={"document": f},
                timeout=60,
            )
    except Exception:
        send_text(chat_id, "Не удалось отправить файл. Напишите автору: @VadimKILL")


WELCOME = (
    "Здравствуйте! Это бот Вадима Кильчурина.\n\n"
    "📘 Гайд «Как решить любой вопрос через систему за 30 дней»:\n"
    "• 13 лет опыта в системе (от начальника отдела ЖКХ до главы поселения)\n"
    "• 6 готовых шаблонов жалоб и заявлений\n"
    "• Пошаговый план и чек-лист на 30 дней\n"
    "• Результат: ответ и решение вашего вопроса — вместо тишины\n\n"
    f"Стоимость: {PRICE}"
)


@app.route("/webhook", methods=["POST"])
def webhook():
    update = request.get_json(silent=True)
    if not update:
        return "ok"

    if "message" in update:
        msg = update["message"]
        chat_id = msg["chat"]["id"]
        send_text(chat_id, WELCOME, [[("Купить гайд за " + PRICE, "buy")]])

    if "callback_query" in update:
        cb = update["callback_query"]
        chat_id = cb["message"]["chat"]["id"]
        data = cb.get("data", "")
        tg("answerCallbackQuery", callback_query_id=cb["id"])

        if data == "buy":
            send_text(chat_id, PAYMENT_TEXT, [[("Я оплатил", "paid")]])

        elif data == "paid":
            send_text(
                ADMIN_ID,
                f"💳 Покупатель (id {chat_id}) сообщил об оплате.\nПроверьте поступление и подтвердите.",
                [[("✅ Подтвердить", f"confirm:{chat_id}"), ("❌ Отклонить", f"reject:{chat_id}")]],
            )
            send_text(chat_id, "Спасибо! Я уведомил автора. Как только он подтвердит оплату — сразу отправлю гайд.")

        elif data.startswith("confirm:"):
            buyer = int(data.split(":")[1])
            send_pdf(buyer)
            send_text(chat_id, "Гайд отправлен покупателю.")

        elif data.startswith("reject:"):
            buyer = int(data.split(":")[1])
            send_text(buyer, "Оплата не подтверждена. Если вы оплатили — напишите автору: @VadimKILL")
            send_text(chat_id, "Отклонено.")

    return "ok"


@app.route("/setup", methods=["GET"])
def setup():
    """Однократный запуск: подключает webhook. Откройте в браузере после деплоя."""
    url = "https://" + request.host + "/webhook"
    try:
        r = requests.get(API + "/setWebhook", params={"url": url}, timeout=30)
        return "setWebhook -> " + str(r.status_code) + " " + r.text
    except Exception as e:
        return "Ошибка: " + str(e)


@app.route("/")
def index():
    return "Bot is running"