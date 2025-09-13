"use client";

import { Button, Container, List, ThemeIcon, Title } from "@mantine/core";
import { IconCircleDashed } from "@tabler/icons-react";
import { doc, getDoc } from "firebase/firestore";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/firebase/auth";
import { useFirebase } from "@/lib/firebase/firebase-provider";
import { Team } from "@/types/Team";

export default function TeamsPage() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { db } = useFirebase();
  const router = useRouter();
  const [teams, setTeams] = useState<Team[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isAuthLoading) {
      return;
    }
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
      setIsLoading(false);
    };

    fetchTeams();
  }, [user, isAuthLoading, db, router]);

  if (isAuthLoading || isLoading) {
    return <Container>Loading...</Container>;
  }
  
  if (!user) {
    return null;
  }

  return (
    <Container>
      <Title order={1}>チーム一覧</Title>
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
          mt="md"
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
      <Button component={Link} href="/teams/new" mt="xl">
        新しいチームを作成
      </Button>
    </Container>
  );
}