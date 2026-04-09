import type { Pet } from "@/lib/types";

interface PetHeaderProps {
  pet: Pet;
  reportCount: number;
}

function calcAge(birthDate: string | null): string | null {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  const now = new Date();
  const years = now.getFullYear() - birth.getFullYear();
  const months = now.getMonth() - birth.getMonth();
  const totalMonths = years * 12 + months;
  if (totalMonths < 12) return `${totalMonths} 個月`;
  return `${Math.floor(totalMonths / 12)} 歲`;
}

export function PetHeader({ pet, reportCount }: PetHeaderProps) {
  const age = calcAge(pet.birth_date);
  const details = [pet.species, pet.breed, age].filter(Boolean).join(" · ");

  return (
    <div className="rounded-xl bg-white p-5 shadow-sm">
      <h1 className="text-2xl font-bold">{pet.name}</h1>
      {details && (
        <p className="mt-1 text-sm text-gray-500">{details}</p>
      )}
      <p className="mt-2 text-sm text-gray-400">
        {reportCount} 份報告
      </p>
    </div>
  );
}
