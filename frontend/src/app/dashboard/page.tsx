"use client";

import { Button, Container, List, ThemeIcon } from "@mantine/core";
import { IconCircleDashed } from "@tabler/icons-react";
import { doc, getDoc } from "firebase/firestore";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/firebase/auth";
import { useFirebase } from "@/lib/firebase/firebase-provider";
import { Team } from "@/types/Team";

export default function Dashboard() {
  const { user, isLoading: isAuthLoading } = useAuth(); // 認証状態の読み込み
  const { db } = useFirebase();
  const router = useRouter();
  const [teams, setTeams] = useState<Team[]>([]);
  const [isLoading, setIsLoading] = useState(true); // このページのデータ読み込み状態

  useEffect(() => {
    // 認証状態の読み込みが完了するまで何もしない
    if (isAuthLoading) {
      return;
    }
    
    // 認証が終わったが、ユーザーがいない場合はサインインページへ
    if (!user) {
      router.push("/signin");
      return;
    }

    const fetchTeams = async () => {
      if (user.teams && user.teams.length > 0) {
        const teamPromises = user.teams.map((teamId: string) => getDoc(doc(db, "teams", teamId)));
        const teamDocs = await Promise.all(teamPromises);
        const userTeams = teamDocs.map((doc) => ({ id: doc.id, ...doc.data() } as Team));
        setTeams(userTeams);
      }
      setIsLoading(false); // データ読み込み完了
    };

    fetchTeams();
  }, [user, isAuthLoading, db, router]);

  // 認証中またはデータ読み込み中はローディング画面を表示
  if (isAuthLoading || isLoading) {
    return <Container>Loading...</Container>;
  }
  
  // 認証は完了したがユーザーがいない場合（リダイレクトまでの間）
  if (!user) {
    return null;
  }

  return (
    <Container>
      <h1>Dashboard</h1>
      <p>ようこそ, {user.displayName || user.email}さん</p>
      <h2>所属チーム</h2>
      {teams.length > 0 ? (
        <List
          spacing="xs"
          size="sm"
          center
          icon={
            <ThemeIcon color="teal" size={24} radius="xl">
              <IconCircleDashed size="1rem" />
            </ThemeIcon>
          }
        >
          {teams.map((team) => (
            <List.Item key={team.id}>
              <Link href={`/teams/${team.id}`}>{team.name}</Link>
            </List.Item>
          ))}
        </List>
      ) : (
        <p>所属しているチームはありません。</p>
      )}
      <Button component={Link} href="/teams/new" mt="md">
        新しいチームを作成
      </Button>
    </Container>
  );
}