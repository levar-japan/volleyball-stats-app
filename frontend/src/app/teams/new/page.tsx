"use client";

import { Button, Container, TextInput, Title } from "@mantine/core";
import { collection, addDoc, serverTimestamp, arrayUnion, doc, updateDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/lib/firebase/auth";
import { useFirebase } from "@/lib/firebase/firebase-provider";

export default function NewTeamPage() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { db } = useFirebase();
  const router = useRouter();
  const [teamName, setTeamName] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleCreateTeam = async () => {
    if (!teamName.trim() || !user) return;

    setIsLoading(true);
    try {
      // 1. `teams`コレクションに新しいチームドキュメントを追加
      const teamDocRef = await addDoc(collection(db, "teams"), {
        name: teamName.trim(),
        createdAt: serverTimestamp(),
        createdBy: user.uid,
        members: [user.uid], // 作成者を最初のメンバーとして追加
      });

      // 2. `users`コレクションの該当ユーザードキュメントに、新しいチームIDを追加
      const userDocRef = doc(db, "users", user.uid);
      await updateDoc(userDocRef, {
        teams: arrayUnion(teamDocRef.id),
      });

      // 3. チーム一覧ページに戻る
      router.push("/teams");
    } catch (error) {
      console.error("Error creating team: ", error);
      setIsLoading(false);
    }
  };

  if (isAuthLoading) {
    return <Container>Loading...</Container>;
  }
  
  if (!user) {
    // 認証されていない場合は、useEffectでリダイレクトされるのを待つか、
    // ここでリダイレクト処理を書いても良い
    router.push("/signin");
    return null;
  }

  return (
    <Container>
      <Title order={1}>新しいチームを作成</Title>
      <TextInput
        label="チーム名"
        placeholder="チームの名前を入力してください"
        value={teamName}
        onChange={(event) => setTeamName(event.currentTarget.value)}
        required
        mt="md"
      />
      <Button onClick={handleCreateTeam} loading={isLoading} disabled={!teamName.trim()} mt="xl">
        作成する
      </Button>
    </Container>
  );
}