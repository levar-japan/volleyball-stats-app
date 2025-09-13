"use client"; // この一行が最も重要です

import { Button, Container, Stack, Title } from "@mantine/core";
import Link from "next/link";
import { useAuth } from "../lib/firebase/auth";
export default function Home() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <Container>
      <Stack align="center" mt="xl">
        <Title order={1}>Volleyball Stats App</Title>
        {user ? (
          <Stack align="center">
            <p>ようこそ, {user.displayName || "ユーザー"}さん</p>
            <Link href="/teams" passHref>
              <Button component="a">チーム一覧へ</Button>
            </Link>
          </Stack>
        ) : (
          <Stack align="center">
            <p>ログインしていません</p>
            <Link href="/signin" passHref>
              <Button component="a">ログイン</Button>
            </Link>
            <Link href="/signup" passHref>
              <Button component="a" variant="outline">
                サインアップ
              </Button>
            </Link>
          </Stack>
        )}
      </Stack>
    </Container>
  );
}