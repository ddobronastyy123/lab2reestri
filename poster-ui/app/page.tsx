"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useState } from "react";
import Web3 from "web3";

const CONTRACT_ADDRESS = "0xF7A6BAe3C759a740dE2498856522939c983C15b6";
const DEPLOY_BLOCK = 11916784; 
const SEPOLIA_CHAIN_ID = "0xaa36a7"; // 11155111
const READ_RPC = "https://ethereum-sepolia-rpc.publicnode.com";
const CHUNK = 20000; 

const ABI: any[] = [
  {
    type: "event",
    name: "NewPost",
    anonymous: false,
    inputs: [
      { indexed: true, name: "user", type: "address" },
      { indexed: false, name: "content", type: "string" },
      { indexed: true, name: "tag", type: "string" },
      { indexed: false, name: "tagText", type: "string" },
    ],
  },
  {
    type: "function",
    name: "post",
    stateMutability: "nonpayable",
    inputs: [
      { name: "content", type: "string" },
      { name: "tag", type: "string" },
    ],
    outputs: [],
  },
];

type Post = { user: string; content: string; tag: string; block: string };

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export default function Home() {
  const [web3, setWeb3] = useState<Web3 | undefined>(undefined);
  const [userAddress, setUserAddress] = useState<string | undefined>(undefined);
  const [content, setContent] = useState("");
  const [tag, setTag] = useState("");
  const [posts, setPosts] = useState<Post[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const loadPosts = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const readWeb3 = new Web3(READ_RPC);
      const contract = new readWeb3.eth.Contract(ABI, CONTRACT_ADDRESS);
      const latest = Number(await readWeb3.eth.getBlockNumber());

      const all: any[] = [];
      for (let from = DEPLOY_BLOCK; from <= latest; from += CHUNK) {
        const to = Math.min(from + CHUNK - 1, latest);
        const part = await contract.getPastEvents("NewPost", {
          fromBlock: from,
          toBlock: to,
        });
        all.push(...part);
      }

      const list: Post[] = all
        .filter((e: any) => typeof e !== "string")
        .map((e: any) => ({
          user: e.returnValues.user as string,
          content: e.returnValues.content as string,
          tag: e.returnValues.tagText as string,
          block: String(e.blockNumber),
        }))
        .reverse(); // новые сверху
      setPosts(list);
    } catch (e: any) {
      setError("Не удалось загрузить посты: " + (e?.message ?? String(e)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  const handleConnect = async () => {
    setError("");
    const eth = (window as any).ethereum;
    if (!eth) {
      setError("MetaMask не найден. Установите расширение в Chrome.");
      return;
    }
    try {
      await eth.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: SEPOLIA_CHAIN_ID }],
      });
      const accounts: string[] = await eth.request({
        method: "eth_requestAccounts",
      });
      setWeb3(new Web3(eth));
      setUserAddress(accounts[0]);
    } catch (e: any) {
      setError("Ошибка подключения: " + (e?.message ?? String(e)));
    }
  };

  const handlePost = async () => {
    if (!web3 || !userAddress) return;
    if (!content.trim() || !tag.trim()) {
      setError("Заполните текст и тег");
      return;
    }
    setSending(true);
    setError("");
    setInfo("Подтвердите транзакцию в MetaMask…");
    try {
      const contract = new web3.eth.Contract(ABI, CONTRACT_ADDRESS);
      await contract.methods.post(content, tag).send({ from: userAddress });
      setContent("");
      setTag("");
      setInfo("Пост опубликован!");
      await loadPosts();
    } catch (e: any) {
      setInfo("");
      setError("Не удалось отправить пост: " + (e?.message ?? String(e)));
    } finally {
      setSending(false);
    }
  };

  const allTags = useMemo(
    () => Array.from(new Set(posts.map((p) => p.tag))),
    [posts]
  );
  const visible = filter ? posts.filter((p) => p.tag === filter) : posts;

  return (
    <div className="min-h-screen bg-zinc-50 p-6 font-sans text-zinc-900 dark:bg-black dark:text-zinc-100">
      <main className="mx-auto flex max-w-2xl flex-col gap-6">
        <h1 className="text-3xl font-bold">Poster: гостевая книга</h1>

        <section className="flex items-center gap-3">
          {userAddress ? (
            <address className="break-all text-sm not-italic">
              Подключён: {userAddress}
            </address>
          ) : (
            <button
              onClick={handleConnect}
              className="rounded bg-blue-600 px-4 py-2 text-white"
            >
              Connect MetaMask
            </button>
          )}
        </section>

        {error && (
          <p className="break-words rounded bg-red-100 p-3 text-red-800">
            {error}
          </p>
        )}
        {info && !error && (
          <p className="rounded bg-green-100 p-3 text-green-800">{info}</p>
        )}

        {userAddress && (
          <section className="flex flex-col gap-2 rounded border p-4">
            <textarea
              className="rounded border bg-transparent p-2"
              placeholder="Текст сообщения"
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
            <input
              className="rounded border bg-transparent p-2"
              placeholder="Тег"
              value={tag}
              onChange={(e) => setTag(e.target.value)}
            />
            <button
              onClick={handlePost}
              disabled={sending}
              className="rounded bg-green-600 px-4 py-2 text-white disabled:opacity-50"
            >
              {sending ? "Отправка…" : "Опубликовать"}
            </button>
          </section>
        )}

        <section className="flex flex-wrap items-center gap-3">
          <label>Фильтр по тегу:</label>
          <select
            className="rounded border bg-transparent p-2"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="">Все</option>
            {allTags.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <button onClick={loadPosts} className="rounded border px-3 py-2">
            Обновить
          </button>
        </section>

        <section className="flex flex-col gap-3">
          {loading && <p>Загрузка…</p>}
          {!loading && visible.length === 0 && <p>Постов нет.</p>}
          {visible.map((p, i) => (
            <article key={i} className="rounded border p-4">
              <p className="whitespace-pre-wrap break-words">{p.content}</p>
              <p className="mt-2 text-sm opacity-70">
                #{p.tag} · от <span title={p.user}>{short(p.user)}</span> ·
                блок {p.block}
              </p>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}