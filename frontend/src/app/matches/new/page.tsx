"use client";

import { Button, Container, Select, TextInput } from "@mantine/core";
// ↓ この行を修正しました
import { doc, getDoc, addDoc, serverTimestamp, collection } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/firebase/auth";
import { useFirebase } from "@/lib/firebase/firebase-provider";
// ↓ Teamのimportは不要なので削除しました

export default function NewMatchPage() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { db } = useFirebase();
  const router = useRouter();
  const [teams, setTeams] = useState<{ label: string; value: string }[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [opponentName, setOpponentName] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isAuthLoading) {
      return;
    }
    if (!user) {
      router.push("/signin");
      return;
    }

    const fetchUserTeams = async () => {
      if (user.teams && user.teams.length > 0) {
        const teamPromises = user.teams.map((teamId: string) => getDoc(doc(db, "teams", teamId)));
        const teamDocs = await Promise.all(teamPromises);
        const userTeams = teamDocs.map((doc) => ({
          label: doc.data()?.name,
          value: doc.id,
        }));
        setTeams(userTeams);
      }
      setIsLoading(false);
    };
    
    fetchUserTeams();
  }, [user, isAuthLoading, db, router]);

  const handleCreateMatch = async () => {
    if (!selectedTeam || !opponentName.trim() || !user) return;
    try {
      // ↓ collection を正しく使うように修正しました
      await addDoc(collection(db, `teams/${selectedTeam}/matches`), {
        opponentName: opponentName.trim(),
        sets: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: user.uid,
      });
      router.push(`/teams/${selectedTeam}`);
    } catch (error) {
      console.error("Error creating match:", error);
    }
  };
  
  if (isAuthLoading || isLoading) {
    return <Container>Loading...</Container>;
  }

  if (!user) {
    return null;
  }

  return (
    <Container>
      <h1>新しい試合を作成</h1>
      <Select
        label="チームを選択"
        placeholder="チームを選んでください"
        data={teams}
        value={selectedTeam}
        onChange={setSelectedTeam}
        required
      />
      <TextInput
        label="対戦相手名"
        placeholder="対戦相手の名前を入力"
        value={opponentName}
        onChange={(e) => setOpponentName(e.currentTarget.value)}
        required
        mt="md"
      />
      <Button onClick={handleCreateMatch} mt="xl" disabled={!selectedTeam || !opponentName.trim()}>
        試合を作成
      </Button>
    </Container>
  );
}