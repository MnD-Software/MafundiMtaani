import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";

const API = Constants.expoConfig?.extra?.apiUrl as string;
type User = { id: string; name: string; email: string; role: string };
type Artisan = {
  id: string;
  name: string;
  trade: string;
  area: string;
  rating: number;
  completed_jobs: number;
  latitude?: number;
  longitude?: number;
};
type Job = {
  id: string;
  reference: string;
  title: string;
  trade: string;
  area: string;
  status: string;
  budget_max: number;
};
type Tab = "explore" | "jobs" | "post" | "map" | "account";

async function request(path: string, token?: string, init?: RequestInit) {
  const response = await fetch(`${API}/v1${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
  });
  const payload = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(payload?.detail || "Request failed");
  return payload;
}

export default function App() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    void SecureStore.getItemAsync("mafundi_token").then(async (stored) => {
      if (stored) {
        try {
          setUser(await request("/auth/me", stored));
          setToken(stored);
        } catch {
          await SecureStore.deleteItemAsync("mafundi_token");
        }
      }
      setReady(true);
    });
  }, []);
  const authenticated = async (access: string, profile: User) => {
    await SecureStore.setItemAsync("mafundi_token", access);
    await SecureStore.setItemAsync("mafundi_role", profile.role);
    setToken(access);
    setUser(profile);
  };
  const logout = async () => {
    await SecureStore.deleteItemAsync("mafundi_token");
    await SecureStore.deleteItemAsync("mafundi_role");
    setToken(null);
    setUser(null);
  };
  if (!ready)
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color="#101310" />
      </SafeAreaView>
    );
  if (!token || !user) return <Auth onAuthenticated={authenticated} />;
  return <Marketplace token={token} user={user} logout={logout} />;
}

function Auth({
  onAuthenticated,
}: {
  onAuthenticated: (token: string, user: User) => Promise<void>;
}) {
  const [register, setRegister] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    account_type: "client",
    referral_code: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = async () => {
    setLoading(true);
    setError("");
    try {
      const payload = await request(
        register ? "/auth/register" : "/auth/login",
        undefined,
        {
          method: "POST",
          body: JSON.stringify(
            register ? form : { email: form.email, password: form.password },
          ),
        },
      );
      await onAuthenticated(payload.access_token, payload.user);
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setLoading(false);
    }
  };
  return (
    <SafeAreaView style={styles.authSafe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.authWrap}
      >
        <Text style={styles.brand}>Mafundi.</Text>
        <Text style={styles.authTitle}>
          {register ? "Create your account." : "Welcome back."}
        </Text>
        <Text style={styles.muted}>
          Trusted work, protected from request to completion.
        </Text>
        {register && (
          <>
            <TextInput
              style={styles.input}
              placeholder="Full name"
              value={form.name}
              onChangeText={(name) => setForm({ ...form, name })}
            />
            <TextInput
              style={styles.input}
              placeholder="Mobile number"
              keyboardType="phone-pad"
              value={form.phone}
              onChangeText={(phone) => setForm({ ...form, phone })}
            />
            <View style={styles.rolePicker}>
              {["client", "artisan"].map((role) => (
                <Pressable
                  key={role}
                  style={[styles.roleChoice, form.account_type === role && styles.active]}
                  onPress={() => setForm({ ...form, account_type: role })}
                >
                  <Text style={form.account_type === role ? styles.activeText : styles.navText}>
                    {role === "client" ? "I need work" : "I offer services"}
                  </Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              style={styles.input}
              autoCapitalize="characters"
              placeholder="Referral code (optional)"
              value={form.referral_code}
              onChangeText={(referral_code) => setForm({ ...form, referral_code })}
            />
          </>
        )}
        <TextInput
          style={styles.input}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="Email"
          value={form.email}
          onChangeText={(email) => setForm({ ...form, email })}
        />
        <TextInput
          style={styles.input}
          secureTextEntry
          placeholder="Password"
          value={form.password}
          onChangeText={(password) => setForm({ ...form, password })}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable
          disabled={loading}
          style={styles.primary}
          onPress={() => void submit()}
        >
          <Text style={styles.primaryText}>
            {loading ? "Please wait…" : register ? "Create account" : "Sign in"}
          </Text>
        </Pressable>
        <Pressable onPress={() => setRegister(!register)}>
          <Text style={styles.link}>
            {register
              ? "Already have an account? Sign in"
              : "New to Mafundi? Create an account"}
          </Text>
        </Pressable>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Marketplace({
  token,
  user,
  logout,
}: {
  token: string;
  user: User;
  logout: () => Promise<void>;
}) {
  const [tab, setTab] = useState<Tab>("explore");
  const fade = useRef(new Animated.Value(1)).current;
  const tabs: Tab[] =
    user.role === "artisan"
      ? ["explore", "jobs", "map", "account"]
      : ["explore", "jobs", "post", "map", "account"];
  const change = (next: Tab) => {
    Animated.timing(fade, {
      toValue: 0,
      duration: 90,
      useNativeDriver: true,
    }).start(() => {
      setTab(next);
      Animated.timing(fade, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }).start();
    });
  };
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.brand}>Mafundi.</Text>
        <Text style={styles.pill}>{user.role.toUpperCase()}</Text>
      </View>
      <Animated.View style={[styles.content, { opacity: fade }]}>
        {tab === "explore" && <Explore token={token} canSave={user.role!=="artisan"} />}{" "}
        {tab === "jobs" && <Jobs token={token} user={user} />}{" "}
        {tab === "post" && <PostJob token={token} />}{" "}
        {tab === "map" && <Coverage />}{" "}
        {tab === "account" && <Account user={user} logout={logout} />}
      </Animated.View>
      <View style={styles.nav}>
        {tabs.map((item) => (
          <Pressable
            key={item}
            onPress={() => change(item)}
            style={[styles.navItem, tab === item && styles.active]}
          >
            <Text style={tab === item ? styles.activeText : styles.navText}>
              {item}
            </Text>
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}

function Explore({ token,canSave }: { token: string;canSave:boolean }) {
  const [items, setItems] = useState<Artisan[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [favorites,setFavorites]=useState<Set<string>>(new Set());
  const { width } = useWindowDimensions();
  useEffect(() => {
    void request("/artisans?available=true", token)
      .then(setItems)
      .finally(() => setLoading(false));
    if(canSave)void request("/favorites",token).then((rows:Array<{artisan:{id:string}}>)=>setFavorites(new Set(rows.map(row=>row.artisan.id)))).catch(()=>undefined);
  }, [token,canSave]);
  const toggleFavorite=async(id:string)=>{
    const active=favorites.has(id);
    await request(`/favorites/${id}`,token,{method:active?"DELETE":"POST"});
    setFavorites(current=>{const next=new Set(current);active?next.delete(id):next.add(id);return next});
  };
  const visible = useMemo(
    () =>
      items.filter((item) =>
        `${item.name} ${item.trade} ${item.area}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [items, query],
  );
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>
        Trusted help,{`\n`}right around the corner.
      </Text>
      <TextInput
        style={styles.search}
        value={query}
        onChangeText={setQuery}
        placeholder="Plumber, electrician or estate"
      />
      {loading ? (
        <ActivityIndicator />
      ) : (
        <FlatList
          horizontal={width < 700}
          numColumns={width >= 700 ? 2 : 1}
          key={width >= 700 ? "grid" : "rail"}
          showsHorizontalScrollIndicator={false}
          data={visible}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={[styles.card, { width: Math.min(width * 0.76, 320) }]}>
              {canSave?<Pressable accessibilityLabel={favorites.has(item.id)?"Remove saved artisan":"Save artisan"} onPress={()=>void toggleFavorite(item.id)} style={styles.mobileFavorite}><Text style={styles.mobileFavoriteText}>{favorites.has(item.id)?"♥":"♡"}</Text></Pressable>:null}
              <View
                style={[styles.avatar, item.rating >= 4.8 && styles.topAvatar]}
              >
                <Text style={styles.initials}>
                  {item.name
                    .split(" ")
                    .map((part) => part[0])
                    .join("")
                    .slice(0, 2)}
                </Text>
                {item.rating >= 4.8 && item.completed_jobs >= 10 ? (
                  <Text style={styles.topPro}>TOP PROFESSIONAL</Text>
                ) : null}
              </View>
              <Text style={styles.cardTitle}>{item.name}</Text>
              <Text style={styles.muted}>
                {item.trade} · {item.area}
              </Text>
              <Text style={styles.rating}>
                ★ {item.rating || "New"} · {item.completed_jobs} jobs
              </Text>
            </View>
          )}
        />
      )}
    </View>
  );
}
function Jobs({ token, user }: { token: string; user: User }) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selected, setSelected] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    void request("/jobs", token)
      .then(setJobs)
      .finally(() => setLoading(false));
  }, [token]);
  if (selected)
    return (
      <JobRoom
        token={token}
        user={user}
        job={selected}
        close={() => setSelected(null)}
      />
    );
  return (
    <ScrollView style={styles.screen}>
      <Text style={styles.title}>Your jobs.</Text>
      {loading ? (
        <ActivityIndicator />
      ) : jobs.length ? (
        jobs.map((job) => (
          <Pressable
            onPress={() => setSelected(job)}
            style={styles.listCard}
            key={job.id}
          >
            <Text style={styles.cardTitle}>{job.title}</Text>
            <Text style={styles.muted}>
              {job.reference} · {job.trade} · {job.area}
            </Text>
            <Text style={styles.status}>{job.status.replaceAll("_", " ")}</Text>
          </Pressable>
        ))
      ) : (
        <Empty text="No jobs yet. New activity will appear here." />
      )}
    </ScrollView>
  );
}

type Room = {
  job: Job;
  viewer: { id: string; role: string };
  messages: { id: string; sender_id: string; body: string }[];
  quotes: {
    id: string;
    artisan_name: string;
    amount: number;
    message: string;
    status: string;
  }[];
  milestones: { id: string; title: string; amount: number; status: string }[];
};
function JobRoom({
  token,
  user,
  job,
  close,
}: {
  token: string;
  user: User;
  job: Job;
  close: () => void;
}) {
  const [room, setRoom] = useState<Room | null>(null);
  const [text, setText] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [notice, setNotice] = useState("");
  const load = () =>
    void request(`/jobs/${job.id}/room`, token)
      .then(setRoom)
      .catch((error) => setNotice(error.message));
  useEffect(load, [job.id]);
  const act = async (path: string, body: object) => {
    try {
      await request(path, token, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setText("");
      setAmount("");
      setNote("");
      load();
    } catch (error) {
      setNotice((error as Error).message);
    }
  };
  if (!room)
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  return (
    <ScrollView style={styles.screen}>
      <Pressable onPress={close}>
        <Text style={styles.linkLeft}>‹ All jobs</Text>
      </Pressable>
      <Text style={styles.title}>{room.job.title}</Text>
      <Text style={styles.muted}>
        {room.job.reference} · {room.job.status}
      </Text>
      {user.role === "artisan" && room.job.status === "open" ? (
        <View style={styles.roomCard}>
          <Text style={styles.cardTitle}>Send a quote</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={amount}
            onChangeText={setAmount}
            placeholder="Amount (KES)"
          />
          <TextInput
            style={styles.input}
            value={note}
            onChangeText={setNote}
            placeholder="Scope and timing"
          />
          <Pressable
            style={styles.primary}
            onPress={() =>
              void act("/quotes", {
                job_id: job.id,
                amount: Number(amount),
                message: note,
                eta_hours: 24,
              })
            }
          >
            <Text style={styles.primaryText}>Submit quote</Text>
          </Pressable>
        </View>
      ) : null}
      {room.quotes.length ? (
        <View style={styles.roomCard}>
          <Text style={styles.cardTitle}>Quotes</Text>
          {room.quotes.map((quote) => (
            <View key={quote.id} style={styles.roomRow}>
              <View>
                <Text style={styles.rowStrong}>{quote.artisan_name}</Text>
                <Text style={styles.muted}>
                  {quote.message} · KES {quote.amount.toLocaleString()}
                </Text>
              </View>
              {user.role !== "artisan" && quote.status === "pending" ? (
                <Pressable
                  onPress={() => void act(`/quotes/${quote.id}/accept`, {})}
                >
                  <Text style={styles.actionText}>Accept</Text>
                </Pressable>
              ) : (
                <Text style={styles.status}>{quote.status}</Text>
              )}
            </View>
          ))}
        </View>
      ) : null}
      <View style={styles.roomCard}>
        <Text style={styles.cardTitle}>Secure messages</Text>
        {room.messages.map((message) => (
          <View
            key={message.id}
            style={[
              styles.bubble,
              message.sender_id === room.viewer.id && styles.mine,
            ]}
          >
            <Text>{message.body}</Text>
          </View>
        ))}
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Write a message"
        />
        <Pressable
          disabled={!text.trim()}
          style={styles.primary}
          onPress={() =>
            void act(`/jobs/${job.id}/messages`, { body: text, kind: "text" })
          }
        >
          <Text style={styles.primaryText}>Send</Text>
        </Pressable>
      </View>
      <View style={styles.roomCard}>
        <Text style={styles.cardTitle}>Milestones</Text>
        {room.milestones.length ? (
          room.milestones.map((item) => (
            <View key={item.id} style={styles.roomRow}>
              <Text style={styles.rowStrong}>{item.title}</Text>
              <Text style={styles.muted}>
                KES {item.amount.toLocaleString()} · {item.status}
              </Text>
            </View>
          ))
        ) : (
          <Text style={styles.muted}>No milestones yet.</Text>
        )}
        {user.role === "artisan" ? (
          <>
            <TextInput
              style={styles.input}
              value={note}
              onChangeText={setNote}
              placeholder="Milestone title"
            />
            <TextInput
              style={styles.input}
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              placeholder="Amount"
            />
            <Pressable
              style={styles.secondary}
              onPress={() =>
                void act(`/jobs/${job.id}/milestones`, {
                  title: note,
                  amount: Number(amount),
                })
              }
            >
              <Text>Propose milestone</Text>
            </Pressable>
          </>
        ) : null}
      </View>
      {user.role !== "artisan" &&
      ["assigned", "in_progress"].includes(room.job.status) ? (
        <View style={styles.roomCard}>
          <Text style={styles.cardTitle}>Protected M-Pesa payment</Text>
          <TextInput
            style={styles.input}
            value={note}
            onChangeText={setNote}
            keyboardType="phone-pad"
            placeholder="2547XXXXXXXX"
          />
          <TextInput
            style={styles.input}
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
            placeholder="Amount (KES)"
          />
          <Pressable
            style={styles.primary}
            onPress={() =>
              void act("/payments/mpesa/checkout", {
                job_id: job.id,
                phone: note,
                amount: Number(amount),
                promotion_code: "",
              })
            }
          >
            <Text style={styles.primaryText}>Send M-Pesa prompt</Text>
          </Pressable>
        </View>
      ) : null}
      {room.job.status === "completed" && user.role !== "artisan" ? (
        <View style={styles.roomCard}>
          <Text style={styles.cardTitle}>Rate the work</Text>
          <TextInput
            style={styles.input}
            value={note}
            onChangeText={setNote}
            placeholder="Share your experience"
          />
          <Pressable
            style={styles.primary}
            onPress={() =>
              void act(`/jobs/${job.id}/reviews`, { rating: 5, comment: note })
            }
          >
            <Text style={styles.primaryText}>Submit 5-star review</Text>
          </Pressable>
        </View>
      ) : null}
      {notice ? <Text style={styles.error}>{notice}</Text> : null}
    </ScrollView>
  );
}
function PostJob({ token }: { token: string }) {
  const [form, setForm] = useState({
    client_name: "",
    client_phone: "",
    trade: "Plumbing",
    title: "",
    description: "",
    area: "Kilimani",
    urgency: "this_week",
    budget_min: 0,
    budget_max: 0,
  });
  const [message, setMessage] = useState("");
  const submit = async () => {
    try {
      const job = await request("/jobs", token, {
        method: "POST",
        body: JSON.stringify(form),
      });
      setMessage(`${job.reference} posted successfully.`);
    } catch (reason) {
      setMessage((reason as Error).message);
    }
  };
  return (
    <ScrollView style={styles.screen}>
      <Text style={styles.title}>Post a job.</Text>
      {(
        ["client_name", "client_phone", "title", "description", "area"] as const
      ).map((field) => (
        <TextInput
          key={field}
          multiline={field === "description"}
          style={[styles.input, field === "description" && styles.textarea]}
          placeholder={field.replaceAll("_", " ")}
          value={String(form[field])}
          onChangeText={(value) => setForm({ ...form, [field]: value })}
        />
      ))}
      <Pressable style={styles.primary} onPress={() => void submit()}>
        <Text style={styles.primaryText}>Find verified help</Text>
      </Pressable>
      {message ? <Text style={styles.notice}>{message}</Text> : null}
    </ScrollView>
  );
}
function Coverage() {
  const [items, setItems] = useState<Artisan[]>([]);
  useEffect(() => {
    void request("/artisans?available=true").then(setItems);
  }, []);
  return (
    <View style={styles.mapWrap}>
      <MapView
        style={StyleSheet.absoluteFill}
        initialRegion={{
          latitude: -1.286389,
          longitude: 36.817223,
          latitudeDelta: 0.25,
          longitudeDelta: 0.25,
        }}
      >
        {items
          .filter((item) => item.latitude && item.longitude)
          .map((item) => (
            <Marker
              key={item.id}
              coordinate={{
                latitude: item.latitude!,
                longitude: item.longitude!,
              }}
              title={item.name}
              description={`${item.trade} · ${item.area}`}
            />
          ))}
      </MapView>
    </View>
  );
}
function Account({
  user,
  logout,
}: {
  user: User;
  logout: () => Promise<void>;
}) {
  return (
    <View style={[styles.screen, styles.account]}>
      <View style={styles.accountAvatar}>
        <Text style={styles.initials}>
          {user.name
            .split(" ")
            .map((part) => part[0])
            .join("")
            .slice(0, 2)}
        </Text>
      </View>
      <Text style={styles.title}>{user.name}</Text>
      <Text style={styles.muted}>
        {user.email} · {user.role}
      </Text>
      <Pressable style={styles.secondary} onPress={() => void logout()}>
        <Text>Sign out</Text>
      </Pressable>
    </View>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.muted}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  authSafe: { flex: 1, backgroundColor: "#f6f7f3" },
  authWrap: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    maxWidth: 520,
    width: "100%",
    alignSelf: "center",
  },
  authTitle: {
    fontSize: 38,
    fontWeight: "800",
    letterSpacing: -1.8,
    marginTop: 34,
    marginBottom: 7,
  },
  header: {
    height: 64,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderColor: "#eceeea",
  },
  brand: { fontSize: 22, fontWeight: "800", letterSpacing: -1 },
  pill: {
    fontSize: 9,
    fontWeight: "800",
    backgroundColor: "#d9ff66",
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 9,
  },
  content: { flex: 1 },
  screen: { flex: 1, padding: 20 },
  title: {
    fontSize: 34,
    fontWeight: "800",
    letterSpacing: -1.6,
    lineHeight: 38,
    marginBottom: 20,
  },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: "#dfe3dc",
    borderRadius: 14,
    paddingHorizontal: 15,
    fontSize: 15,
    backgroundColor: "#fff",
    marginTop: 10,
  },
  textarea: { minHeight: 110, textAlignVertical: "top", paddingTop: 14 },
  search: {
    height: 54,
    borderWidth: 1,
    borderColor: "#dfe3dc",
    borderRadius: 16,
    paddingHorizontal: 16,
    fontSize: 15,
    marginBottom: 20,
  },
  primary: {
    minHeight: 52,
    backgroundColor: "#101310",
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 15,
  },
  primaryText: { color: "#fff", fontWeight: "800" },
  secondary: {
    borderWidth: 1,
    borderColor: "#dfe3dc",
    borderRadius: 13,
    padding: 14,
    marginTop: 30,
  },
  link: {
    textAlign: "center",
    fontWeight: "700",
    marginTop: 20,
    color: "#147d64",
  },
  error: { color: "#9c3434", marginTop: 10 },
  notice: { color: "#147d64", marginTop: 14, fontWeight: "700" },
  card: {
    position: "relative",
    borderWidth: 1,
    borderColor: "#e4e8e2",
    borderRadius: 20,
    padding: 14,
    marginRight: 12,
    marginBottom: 12,
  },
  mobileFavorite:{position:"absolute",zIndex:3,top:12,right:12,width:40,height:40,borderRadius:20,alignItems:"center",justifyContent:"center",backgroundColor:"#ffffff",shadowColor:"#000",shadowOpacity:.1,shadowRadius:8},
  mobileFavoriteText:{fontSize:22,color:"#101310"},
  avatar: {
    height: 170,
    borderRadius: 15,
    backgroundColor: "#e4f1ea",
    alignItems: "center",
    justifyContent: "center",
  },
  topAvatar: {
    borderWidth: 2,
    borderColor: "#c9a94f",
    backgroundColor: "#fff6d6",
  },
  initials: { fontSize: 36, fontWeight: "800", color: "#174f43" },
  topPro: {
    position: "absolute",
    bottom: 12,
    fontSize: 9,
    fontWeight: "900",
    color: "#6b4e00",
  },
  cardTitle: { fontSize: 17, fontWeight: "800", marginTop: 13 },
  muted: { fontSize: 12, color: "#697069", marginTop: 5, lineHeight: 18 },
  rating: { fontSize: 12, fontWeight: "800", marginTop: 12 },
  listCard: {
    borderWidth: 1,
    borderColor: "#e4e8e2",
    borderRadius: 17,
    padding: 16,
    marginBottom: 11,
  },
  status: {
    alignSelf: "flex-start",
    marginTop: 12,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: "#e6f2eb",
    fontSize: 10,
    fontWeight: "800",
    textTransform: "capitalize",
  },
  mapWrap: { flex: 1, margin: 14, borderRadius: 22, overflow: "hidden" },
  account: { alignItems: "center", justifyContent: "center" },
  accountAvatar: {
    height: 94,
    width: 94,
    borderRadius: 28,
    backgroundColor: "#e4f1ea",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  roomCard: { borderWidth:1, borderColor:"#e4e8e2", borderRadius:18, padding:16, marginTop:16 },
  roomRow: { paddingVertical:12, borderBottomWidth:1, borderBottomColor:"#edf0eb", flexDirection:"row", justifyContent:"space-between", alignItems:"center" },
  rowStrong: { fontSize:13, fontWeight:"800" },
  actionText: { color:"#147d64", fontWeight:"800", padding:8 },
  bubble: { alignSelf:"flex-start", backgroundColor:"#eff2ed", padding:11, borderRadius:12, marginTop:8, maxWidth:"85%" },
  mine: { alignSelf:"flex-end", backgroundColor:"#dff2e8" },
  linkLeft: { color:"#147d64", fontWeight:"800", marginBottom:18 },
  rolePicker: { flexDirection:"row", gap:8, marginTop:10 },
  roleChoice: { flex:1, padding:12, borderWidth:1, borderColor:"#dfe3dc", borderRadius:12, alignItems:"center" },
  empty: { padding: 35, alignItems: "center" },
  nav: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    borderTopWidth: 1,
    borderColor: "#e5e8e3",
    paddingHorizontal: 8,
    paddingBottom: Platform.OS === "ios" ? 8 : 0,
  },
  navItem: { padding: 10, borderRadius: 12 },
  active: { backgroundColor: "#101310" },
  navText: { fontSize: 10, color: "#4f554f", textTransform: "capitalize" },
  activeText: {
    fontSize: 10,
    color: "#fff",
    textTransform: "capitalize",
    fontWeight: "800",
  },
});
