# TaskFlow

**TaskFlow** — тапсырмалар тізімін (To-Do) басқаруға арналған веб-қосымша (веб-интерфейс + REST API).
«Бағдарламалық қамтамасыздандыруды тестілеу» пәнінің 1, 2, 3-тапсырмаларына арналған бірыңғай жоба.

- **Орындаған:** Оразбай Айтуған, тобы Рпо1-23к
- **Стек:** Node.js (сыртқы тәуелділіксіз), HTML/CSS/JS клиент, деректер жад ішінде (in-memory)

## Талаптар

- [Node.js](https://nodejs.org/) 18+ (`node -v`)
- 2-тапсырма үшін: Postman, браузер (Chrome DevTools)
- 3-тапсырма үшін: [Apache JMeter](https://jmeter.apache.org/download_jmeter.cgi) 5.6.x және Java 8+

## Іске қосу (VS Code)

1. VS Code-та *File → Open Folder* арқылы `taskflow` қалтасын ашыңыз
2. *Terminal → New Terminal* ашып, орындаңыз:

```bash
npm start
```

3. Браузерде **http://localhost:3000** ашыңыз — TaskFlow интерфейсі шығады (тіркелу, кіру, тапсырма қосу/өзгерту/жою, сүзу, іздеу)

Басқа порт: `PORT=4000 npm start` (Windows PowerShell: `$env:PORT=4000; npm start`).

## Жоба құрылымы

```
taskflow/
├── server/server.js                 # REST API + статикалық файлдар
├── public/                          # веб-клиент (index.html, app.css, app.js)
├── test/api-tests.js                # 2-тапсырма: 23 тест-кейсті автоматты орындау
├── postman/TaskFlow_Postman_Collection.json   # 2-тапсырма: Postman топтамасы
├── jmeter/TaskFlow_LoadTest.jmx     # 3-тапсырма: жүктемелік тест жоспары
├── docs/                            # 1, 2, 3-тапсырма есептері (docx)
├── logs/                            # app.log, error.log (сервер қосылғанда жасалады)
└── package.json
```

## API

| Әдіс | Жол | Токен | Сипаттама | Сәтті код |
|------|-----|-------|-----------|-----------|
| POST | `/api/register` | жоқ | Тіркелу (`email`, `password` 8–20 таңба) | 201 |
| POST | `/api/login` | жоқ | Кіру: токен қайтарады және `session` cookie қояды | 200 |
| POST | `/api/logout` | жоқ | Cookie тазалау | 200 |
| GET | `/api/tasks?status=done` | иә | Өз тапсырмалары (сүзгімен) | 200 |
| POST | `/api/tasks` | иә | Тапсырма қосу (`title` 1–100 таңба) | 201 |
| PUT | `/api/tasks/{id}` | иә | Тапсырманы жаңарту | 200 |
| DELETE | `/api/tasks/{id}` | иә | Тапсырманы жою | 200 |
| GET | `/api/health` | жоқ | Сервер күйі | 200 |

Токен: `Authorization: Bearer <token>` тақырыбы немесе `session` cookie.
Статикалық файлдар `Cache-Control: public, max-age=3600` және `ETag` қайтарады (қайта жүктегенде 304).

## 2-тапсырма: тест құжаттамасы, DevTools, Postman, баг-репорт

- **Автотест:** сервер қосулы тұрғанда екінші терминалда `npm test` — 23 тест-кейс (нәтиже: 20 Passed, 3 Failed).
- **Postman:** *Import* → `postman/TaskFlow_Postman_Collection.json` → *Run collection*. Айнымалылар: baseUrl, email, token, taskId.
- **DevTools:** браузерде F12 → Network / Application → Cookies (`session`, HttpOnly) ; `app.css` қайта жүктегенде 304.
- **Логтар:** `logs/error.log` — BUG-001 кезінде стек-трейс осында жазылады.

## 3-тапсырма: жүктемелік тестілеу (Apache JMeter)

Тест жоспары: `jmeter/TaskFlow_LoadTest.jmx`.
Әр пайдаланушы бір рет тіркеледі және кіреді, содан кейін 10 цикл бойы `GET /api/tasks` және `POST /api/tasks` жібереді (Constant Timer 500 мс).

| Кезең | Threads | Ramp-Up (сек) | Циклдер |
|-------|---------|---------------|---------|
| 1 | 10 | 10 | 10 |
| 2 | 50 | 30 | 10 |
| 3 | 100 | 60 | 10 |
| 4 | 200 | 120 | 10 |

**GUI:** серверді қосыңыз (`npm start`) → JMeter → *File → Open* → `.jmx` → ▶ → listener-лерден скриншот алыңыз.

**Консоль (HTML-есеп):**

```bash
jmeter -n -t jmeter/TaskFlow_LoadTest.jmx -l jmeter/results/result.jtl -e -o jmeter/report
```

Мекенжайды өзгерту: `-Jhost=localhost -Jport=3000`.

## Белгілі ақаулар (оқу мақсатында қалдырылған)

- **BUG-001:** `PUT /api/tasks/{id}` — `title` сан болса, 400 орнына 500
- **BUG-002:** `POST /api/tasks` — өткен мерзімге ескерту жоқ
- **BUG-003:** `POST /api/tasks` — жарамсыз күн (`2026-13-45`) қабылданады
