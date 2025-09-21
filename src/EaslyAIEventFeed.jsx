import React, { useEffect, useState } from "react";
import EaslyAIEventCards from "./EaslyAIEventCards";

// This component listens to /users/{uid}/events and renders event cards
export default function EaslyAIEventFeed({ uid, firestore }) {
  const [events, setEvents] = useState([]);
  useEffect(() => {
    if (!uid || !firestore) return;
    const unsub = firestore
      .collection("users")
      .doc(uid)
      .collection("events")
      .orderBy("createdAt", "desc")
      .limit(20)
      .onSnapshot((snap) => {
        const arr = [];
        snap.forEach((doc) => arr.push({ id: doc.id, ...doc.data() }));
        setEvents(arr);
      });
    return () => unsub();
  }, [uid, firestore]);
  return <EaslyAIEventCards events={events} />;
}
