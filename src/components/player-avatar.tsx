import React from 'react';
// icon imports from react-icons
import { BsRobot } from 'react-icons/bs';
import { SiProbot } from 'react-icons/si';
import { PiDogFill } from 'react-icons/pi';
import { BiSolidCat } from 'react-icons/bi';
import { MdElderlyWoman, MdPregnantWoman, MdCatchingPokemon } from 'react-icons/md';
import { GiPyromaniac, GiMonkey, GiBatMask, GiSpiderMask, GiNinjaHead, GiSharkBite, GiDinosaurRex, GiSeaDragon, GiDirectorChair, GiWitchFlight, GiBirdTwitter } from 'react-icons/gi';
import { TbMichelinBibGourmand, TbMoodCrazyHappy } from 'react-icons/tb';
import { VscSnake } from 'react-icons/vsc';
import { RiAliensLine } from 'react-icons/ri';
import { FaUserAstronaut } from 'react-icons/fa';

const ICONS: Record<string, React.ComponentType<any>> = {
    BsRobot,
    SiProbot,
    PiDogFill,
    BiSolidCat,
    MdElderlyWoman,
    MdPregnantWoman,
    GiPyromaniac,
    TbMichelinBibGourmand,
    TbMoodCrazyHappy,
    GiMonkey,
    GiBatMask,
    GiSpiderMask,
    GiNinjaHead,
    VscSnake,
    GiSharkBite,
    GiDinosaurRex,
    GiSeaDragon,
    MdCatchingPokemon,
    GiDirectorChair,
    RiAliensLine,
    GiWitchFlight,
    FaUserAstronaut,
    GiBirdTwitter,
};

export default function PlayerAvatar({ avatarKey, size = 20, className = '' }: { avatarKey?: string; size?: number; className?: string }) {
    console.log('avatarKey:', avatarKey);
    const key = typeof avatarKey === 'string' ? avatarKey.trim() : '';
    let Icon: React.ComponentType<any> | undefined = key ? ICONS[key] : undefined;
    // Try a case-insensitive match if exact key not found (defensive - tolerates minor mismatches)
    if (!Icon && key) {
        const found = Object.keys(ICONS).find((k) => k.toLowerCase() === key.toLowerCase());
        if (found) Icon = ICONS[found];
    }
    if (Icon) return <Icon size={size} className={className} />;
    // fallback: simple circle
    return (
        <div style={{ width: size, height: size }} className={`rounded-full bg-gray-200 inline-flex items-center justify-center ${className}`}>
            <svg width={size} height={size} />
        </div>
    );
}
