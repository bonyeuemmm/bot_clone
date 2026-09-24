const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, Collection, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const mongoose = require('mongoose');

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const OWNER_ID = process.env.OWNER_ID || '1208450889246048306';
const MONGO_URI = process.env.MONGO_URI;

const MAIN_SERVER_ID = '1454813193028374540';
const SERVER_INVITE_LINK = 'https://discord.gg/z7RUNArBuJ';

const COLORS = {
  DEFAULT: 0x9b59b6,
  MEMBER: 0x3498db,
  SUCCESS: 0x2ecc71,
  ADMIN: 0xf1c40f,
  OWNER: 0xe67e22,
  ERROR: 0xe74c3c
};

const FOOTER_ICON_URL = 'https://i.postimg.cc/gJbhCmHL/Pain-Gamer.png';

mongoose.connect(MONGO_URI)
  .then(() => console.log('🍃 Kết nối MongoDB thành công!'))
  .catch(err => console.error('❌ Lỗi kết nối MongoDB:', err));

const KeySchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  durationMs: Number,
  activatedAt: Date,
  expiresAt: Date
});

const AccessSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  expiresAt: Number,
  durationMs: Number,
  warned24h: { type: Boolean, default: false },
  warned4h: { type: Boolean, default: false }
});

const LinkSchema = new mongoose.Schema({
  category: { type: String, required: true, unique: true },
  links: {
    premium: {
      global: { url: String, version: String, note: String, status: String },
      vng: { url: String, version: String, note: String, status: String }
    }
  }
});

const AdminSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true }
});

const UserSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true }
});

const KeyModel = mongoose.model('Key', KeySchema);
const AccessModel = mongoose.model('Access', AccessSchema);
const LinkModel = mongoose.model('Link', LinkSchema);
const AdminModel = mongoose.model('Admin', AdminSchema);
const UserModel = mongoose.model('User', UserSchema);

const client = new Client({ 
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.DirectMessages] 
});

const commandCooldowns = new Collection();
const COMMAND_COOLDOWN_MS = 10000;
const COOLDOWN_CLEANUP_INTERVAL_MS = 60000;

setInterval(() => {
  const cutoff = Date.now() - COMMAND_COOLDOWN_MS;
  for (const [userId, lastInteractionAt] of commandCooldowns) {
    if (lastInteractionAt <= cutoff) {
      commandCooldowns.delete(userId);
    }
  }
}, COOLDOWN_CLEANUP_INTERVAL_MS).unref();

function formatFooterText() {
  return 'Bot By PAIN';
}

function createBotEmbed({ title, description, fields, user, locale = 'vi', color = COLORS.DEFAULT, timestamp = Date.now() } = {}) {
  const embed = new EmbedBuilder()
    .setColor(color)
    .setFooter({ 
      text: formatFooterText(), 
      iconURL: FOOTER_ICON_URL 
    });

  if (user) {
    embed.setThumbnail(user.displayAvatarURL({ dynamic: true, size: 512 }));
  }

  if (title) embed.setTitle(title);
  if (description) embed.setDescription(description);
  if (fields?.length) embed.addFields(fields);

  return embed;
}

async function autoScanAndCleanExpiredKeys() {
  const now = Date.now();
  const allAccess = await AccessModel.find({});

  for (const userData of allAccess) {
    if (userData.expiresAt !== -1 && Number.isFinite(userData.expiresAt) && now >= userData.expiresAt) {
      try {
        const user = await client.users.fetch(userData.userId);
        await user.send({
          embeds: [
            createBotEmbed({
              title: '⏰ Thông Báo Hết Hạn Key',
              description: 'Thời hạn sử dụng bot của bạn đã hết. Quyền truy cập bot đã tự động bị thu hồi!',
              user,
              color: COLORS.ERROR
            })
          ]
        });
      } catch (_e) {}

      await AccessModel.deleteOne({ userId: userData.userId });
      continue;
    }

    if (Number.isFinite(userData.expiresAt) && userData.expiresAt !== -1) {
      const remainingMs = userData.expiresAt - now;
      const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
      const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
      const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
      const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;

      const isEligibleFor24hWarn = Number.isFinite(userData.durationMs) && 
        userData.durationMs >= THREE_DAYS_MS && 
        userData.durationMs <= THIRTY_DAYS_MS;

      if (isEligibleFor24hWarn && remainingMs <= TWENTY_FOUR_HOURS_MS && remainingMs > FOUR_HOURS_MS && !userData.warned24h) {
        try {
          const user = await client.users.fetch(userData.userId);
          await user.send({
            embeds: [
              createBotEmbed({
                title: '⚠️ Cảnh Báo Hết Hạn Key',
                description: 'Thông báo: Thời hạn dùng bot của bạn sắp hết, thời gian còn lại là 24 giờ!',
                user,
                color: COLORS.OWNER
              })
            ]
          });
          userData.warned24h = true;
          await userData.save();
        } catch (_e) {}
      }

      if (remainingMs <= FOUR_HOURS_MS && !userData.warned4h) {
        try {
          const user = await client.users.fetch(userData.userId);
          await user.send({
            embeds: [
              createBotEmbed({
                title: '⚠️ Cảnh Báo Hết Hạn Key',
                description: 'Thời hạn dùng bot của bạn chỉ còn lại 4 giờ! Vui lòng kích hoạt key mới để gia hạn.',
                user,
                color: COLORS.OWNER
              })
            ]
          });
          userData.warned4h = true;
          userData.warned24h = true;
          await userData.save();
        } catch (_e) {}
      }
    }
  }
}

setInterval(autoScanAndCleanExpiredKeys, 30000);

const commands = [
  new SlashCommandBuilder()
    .setName('setadmin')
    .setDescription('Quản lý quyền Admin Bot (Thêm hoặc Xóa)')
    .addStringOption(option =>
      option.setName('action')
        .setDescription('Chọn hành động')
        .setRequired(true)
        .addChoices(
          { name: 'Add (Thêm Admin)', value: 'add' },
          { name: 'Remove (Xóa Admin)', value: 'remove' }
        )
    )
    .addUserOption(option => option.setName('user').setDescription('Chọn người dùng').setRequired(true)),

  new SlashCommandBuilder()
    .setName('createkey')
    .setDescription('Tạo key mới')
    .addStringOption(option =>
      option.setName('duration')
        .setDescription('Thời hạn của key')
        .setRequired(true)
        .addChoices(
          { name: '1 Ngày', value: '1d' },
          { name: '3 Ngày', value: '3d' },
          { name: '7 Ngày', value: '7d' },
          { name: '30 Ngày', value: '30d' },
          { name: 'Vĩnh viễn', value: 'permanent' }
        )
    )
    .addUserOption(option => option
      .setName('target_user')
      .setDescription('Member nhận key (không bắt buộc)')
      .setRequired(false)),
    
  new SlashCommandBuilder()
    .setName('setlinkclone')
    .setDescription('Tải và thiết lập link + phiên bản cho từng mục')
    .addStringOption(opt => opt.setName('category').setDescription('Tên mục (VD: Delta X)').setRequired(true))
    .addStringOption(opt => opt.setName('region').setDescription('Khu vực').setRequired(true).addChoices({ name: 'Global', value: 'global' }, { name: 'VNG', value: 'vng' }))
    .addStringOption(opt => opt.setName('link').setDescription('Đường link tải').setRequired(true))
    .addStringOption(opt => opt.setName('status').setDescription('Trạng thái').setRequired(true).addChoices(
      { name: '🟢 Hoạt động', value: 'active' },
      { name: '🟡 Đang bảo trì / Chờ update', value: 'maintenance' },
      { name: '🔴 Ngừng hoạt động', value: 'disabled' }
    ))
    .addStringOption(opt => opt.setName('version').setDescription('Phiên bản (VD: v2.640)').setRequired(false))
    .addStringOption(opt => opt.setName('note').setDescription('Ghi chú / Tính năng').setRequired(false)),

  new SlashCommandBuilder()
    .setName('setstatus')
    .setDescription('Chọn khu vực để cập nhật trạng thái bản Clone')
    .addStringOption(opt => opt.setName('region').setDescription('Chọn khu vực').setRequired(true).addChoices({ name: 'Global', value: 'global' }, { name: 'VNG', value: 'vng' })),

  new SlashCommandBuilder()
    .setName('deletelink')
    .setDescription('Chọn khu vực để xóa bản Clone')
    .addStringOption(opt => opt.setName('region').setDescription('Chọn khu vực').setRequired(true).addChoices({ name: 'Global', value: 'global' }, { name: 'VNG', value: 'vng' })),

  new SlashCommandBuilder()
    .setName('setuppanel')
    .setDescription('Tạo bảng điều khiển lấy link cố định trong channel'),

  new SlashCommandBuilder()
    .setName('redeemkey')
    .setDescription('Nhập key để kích hoạt')
    .addStringOption(option => option.setName('key').setDescription('Nhập mã key').setRequired(true)),

  new SlashCommandBuilder()
    .setName('status')
    .setDescription('Kiểm tra thời hạn sử dụng bot còn lại của bạn'),

  new SlashCommandBuilder()
    .setName('removekey')
    .setDescription('Xóa key và thu hồi quyền của member')
    .addStringOption(option => option.setName('key').setDescription('Key cần xóa').setRequired(true)),

  new SlashCommandBuilder()
    .setName('help')
    .setDescription('Hướng dẫn sử dụng bot'),

  new SlashCommandBuilder()
    .setName('notification')
    .setDescription('Gửi thông báo đến các member đã sử dụng bot')
    .addStringOption(option => option
      .setName('message')
      .setDescription('Nội dung thông báo muốn gửi')
      .setRequired(true)
      .setMaxLength(2000))
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log('✅ Registered Slash Commands successfully!');
  } catch (error) {
    console.error(error);
  }
})();

function generateRandomKey() {
  const randomDigits = Math.floor(100000 + Math.random() * 900000);
  return `pain_${randomDigits}`;
}

async function isBotAdmin(userId) {
  if (userId === OWNER_ID) return true;
  const admin = await AdminModel.findOne({ userId });
  return !!admin;
}

async function rememberUser(userId) {
  await UserModel.updateOne({ userId }, { userId }, { upsert: true });
}

function formatExpiry(expireTimestamp) {
  if (expireTimestamp === -1) return 'Vĩnh viễn';
  if (expireTimestamp == null) return 'Chưa kích hoạt';
  return `<t:${Math.floor(expireTimestamp / 1000)}:R>`;
}

function getDurationMilliseconds(duration) {
  if (duration === '1d') return 1 * 24 * 60 * 60 * 1000;
  if (duration === '3d') return 3 * 24 * 60 * 60 * 1000;
  if (duration === '7d') return 7 * 24 * 60 * 60 * 1000;
  if (duration === '30d') return 30 * 24 * 60 * 60 * 1000;
  if (duration === 'permanent') return -1;
  return null;
}

function formatDuration(durationMs) {
  if (durationMs === -1) return 'Vĩnh viễn kể từ lúc redeem';
  if (durationMs == null) return 'Theo thời hạn cũ của key';

  const durationDays = durationMs / (24 * 60 * 60 * 1000);
  return `${durationDays} ngày kể từ lúc redeem`;
}

async function notifyOwner(embed) {
  try {
    const owner = await client.users.fetch(OWNER_ID);
    await owner.send({ embeds: [embed] });
    return true;
  } catch (error) {
    console.error('Không thể gửi DM thông báo cho Owner:', error);
    return false;
  }
}

async function getValidAccessKey(userId) {
  const userData = await AccessModel.findOne({ userId });
  if (!userData) return null;

  const now = Date.now();
  if (userData.expiresAt !== -1 && Number.isFinite(userData.expiresAt) && now >= userData.expiresAt) {
    await AccessModel.deleteOne({ userId });
    return null;
  }

  return userData;
}

client.on('interactionCreate', async interaction => {
  if (!interaction.guildId) {
    return await interaction.reply({
      embeds: [createBotEmbed({
        title: '⛔ KHÔNG THỂ SỬ DỤNG TRONG DM',
        description: `Vui lòng tham gia **Server Chính Thức** để sử dụng tính năng!\n\n👉 [**[ BẤM VÀO ĐÂY ĐỂ VÀO SERVER ]**](${SERVER_INVITE_LINK})`,
        color: COLORS.ERROR
      })],
      ephemeral: true
    });
  }

  if (interaction.guildId !== MAIN_SERVER_ID) {
    return await interaction.reply({
      embeds: [createBotEmbed({
        title: '🏰 MÁY CHỦ BẢO HỘ',
        description: `Bot chỉ hỗ trợ hoạt động tại **Server Chính Thức (Nhà Của Bot)**.\n\n👉 [**[ BẤM VÀO ĐÂY ĐỂ VỀ SERVER NHÀ ]**](${SERVER_INVITE_LINK})`,
        color: COLORS.ERROR
      })],
      ephemeral: true
    });
  }

  const userId = interaction.user.id;
  const userLocale = interaction.locale || 'vi';

  if (userId !== OWNER_ID) {
    const now = Date.now();
    const lastInteractionAt = commandCooldowns.get(userId);

    if (lastInteractionAt && now - lastInteractionAt < COMMAND_COOLDOWN_MS) {
      const remainingTime = Math.ceil((COMMAND_COOLDOWN_MS - (now - lastInteractionAt)) / 1000);
      return await interaction.reply({
        embeds: [
          createBotEmbed({
            title: '⚠️ Anti-Spam System',
            description: `Bạn đang thao tác quá nhanh, vui lòng đợi **${remainingTime}s** nữa để sử dụng lại lệnh!`,
            user: interaction.user,
            locale: userLocale,
            color: COLORS.OWNER
          })
        ],
        ephemeral: true
      });
    }

    commandCooldowns.set(userId, now);
  }

  await rememberUser(interaction.user.id);

  if (interaction.isChatInputCommand()) {
    const { commandName } = interaction;

    if (commandName === 'setuppanel') {
      if (!(await isBotAdmin(interaction.user.id))) return await interaction.reply({ content: '❌ Không đủ quyền!', ephemeral: true });

      const panelEmbed = createBotEmbed({
        title: '🎮 HỆ THỐNG LẤY CLONE ROBLOX PREMIUM',
        description: 'Vui lòng bấm nút bên dưới để lấy roblox và executor premium!',
        color: COLORS.DEFAULT
      });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('btn_type_premium').setLabel('Get Clone').setStyle(ButtonStyle.Success)
      );

      await interaction.channel.send({ embeds: [panelEmbed], components: [row] });
      return await interaction.reply({ content: '✅ Đã tạo Panel thành công!', ephemeral: true });
    }

    if (commandName === 'setstatus') {
      if (!(await isBotAdmin(interaction.user.id))) return await interaction.reply({ content: '❌ Không đủ quyền!', ephemeral: true });

      const region = interaction.options.getString('region');
      const allLinks = await LinkModel.find({});
      const filteredLinks = allLinks.filter(item => item.links?.premium?.[region]?.url);

      if (filteredLinks.length === 0) {
        return await interaction.reply({
          embeds: [createBotEmbed({
            title: '❌ Thao tác thất bại',
            description: `Hiện chưa có bản Clone nào trong hệ thống ở khu vực **${region.toUpperCase()}**!`,
            color: COLORS.ERROR
          })],
          ephemeral: true
        });
      }

      const options = filteredLinks.map(item => {
        const data = item.links.premium[region];
        const vText = data.version || 'v1.0';
        const nText = data.note || 'Không có ghi chú';
        return {
          label: `${item.category} [${vText}]`,
          description: `Phiên bản: ${vText} -${nText}`.slice(0, 100),
          value: `${item.category}\vert{}${region}`
        };
      });

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('admin_select_setstatus_item')
        .setPlaceholder(`--- Chọn bản Clone (${region.toUpperCase()}) ---`)
        .addOptions(options.slice(0, 25));

      const menuEmbed = createBotEmbed({
        title: `⚙️ CẬP NHẬT TRẠNG THÁI (${region.toUpperCase()})`,
        description: 'Vui lòng chọn bản Clone bạn muốn cập nhật trạng thái bên dưới:',
        color: COLORS.ADMIN
      });

      return await interaction.reply({
        embeds: [menuEmbed],
        components: [new ActionRowBuilder().addComponents(selectMenu)],
        ephemeral: true
      });
    }

    if (commandName === 'deletelink') {
      if (!(await isBotAdmin(interaction.user.id))) return await interaction.reply({ content: '❌ Không đủ quyền!', ephemeral: true });

      const region = interaction.options.getString('region');
      const allLinks = await LinkModel.find({});
      const filteredLinks = allLinks.filter(item => item.links?.premium?.[region]?.url);

      if (filteredLinks.length === 0) {
        return await interaction.reply({
          embeds: [createBotEmbed({
            title: '❌ Thao tác thất bại',
            description: `Không có bản Clone nào khả dụng ở khu vực **${region.toUpperCase()}** để xóa!`,
            color: COLORS.ERROR
          })],
          ephemeral: true
        });
      }

      const options = filteredLinks.map(item => {
        const data = item.links.premium[region];
        const vText = data.version || 'v1.0';
        return {
          label: `${item.category} [${vText}]`,
          description: `Phiên bản: ${vText}`.slice(0, 100),
          value: `${item.category}\vert{}${region}`
        };
      });

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('admin_select_delete_item')
        .setPlaceholder(`--- Chọn bản Clone cần xóa (${region.toUpperCase()}) ---`)
        .addOptions(options.slice(0, 25));

      const menuEmbed = createBotEmbed({
        title: `🗑️ XÓA PHIÊN BẢN CLONE (${region.toUpperCase()})`,
        description: 'Vui lòng chọn bản Clone bạn muốn xóa khỏi cơ sở dữ liệu:',
        color: COLORS.ERROR
      });

      return await interaction.reply({
        embeds: [menuEmbed],
        components: [new ActionRowBuilder().addComponents(selectMenu)],
        ephemeral: true
      });
    }

    if (commandName === 'status') {
      const userData = await getValidAccessKey(interaction.user.id);

      if (!userData) {
        return await interaction.reply({
          embeds: [
            createBotEmbed({
              title: '📊 Trạng Thái Tài Khoản',
              description: 'Bạn chưa kích hoạt key hoặc thời hạn đã hết. Hãy nhập key bằng lệnh `/redeemkey`!',
              user: interaction.user,
              locale: userLocale,
              color: COLORS.ERROR
            })
          ],
          ephemeral: true
        });
      }

      if (userData.expiresAt === -1) {
        return await interaction.reply({
          embeds: [
            createBotEmbed({
              title: '📊 Trạng Thái Tài Khoản',
              description: 'Thời hạn sử dụng bot của bạn là **Vĩnh viễn**!',
              user: interaction.user,
              locale: userLocale,
              color: COLORS.SUCCESS
            })
          ],
          ephemeral: true
        });
      }

      return await interaction.reply({
        embeds: [
          createBotEmbed({
            title: '📊 Trạng Thái Tài Khoản',
            description: `Thời hạn sử dụng bot còn lại là ${formatExpiry(userData.expiresAt)}. Bạn chỉ cần nhập 1 key mới ở lệnh /redeemkey có thể cộng dồn thêm thời hạn!`,
            user: interaction.user,
            locale: userLocale,
            color: COLORS.MEMBER
          })
        ],
        ephemeral: true
      });
    }

    if (commandName === 'help') {
      const helpEmbed = createBotEmbed({
        title: '📖 Hướng dẫn sử dụng hệ thống',
        description: 'Dưới đây là các lệnh sẵn có trong bot.',
        user: interaction.user,
        locale: userLocale,
        color: COLORS.MEMBER,
        fields: [
          {
            name: '👥 Dành cho Member',
            value: [
              '`/redeemkey key:<mã-key>` — Nhập key kích hoạt.',
              '`/status` — Kiểm tra thời hạn sử dụng bot còn lại.'
            ].join('\n')
          },
          {
            name: '🛠️ Dành cho Admin',
            value: [
              '`/setuppanel` — Tạo bảng điều khiển lấy link.',
              '`/setlinkclone category:<mục> region:<Global/VNG> link:<URL> status:<trạng-thái>` — Cập nhật link Premium.',
              '`/setstatus region:<Global/VNG>` — Chọn bản Clone để đổi nhanh trạng thái.',
              '`/deletelink region:<Global/VNG>` — Chọn bản Clone để xóa.',
              '`/createkey duration:<thời-hạn> target_user:<member>` — Tạo key kích hoạt.'
            ].join('\n')
          },
          {
            name: '👑 Dành cho Owner',
            value: [
              '`/setadmin action:<Add/Remove> user:<member>` — Thêm hoặc xóa Admin.',
              '`/removekey key:<mã-key>` — Xóa vĩnh viễn key chưa sử dụng.',
              '`/notification message:<nội-dung>` — Gửi tin nhắn hàng loạt qua DM.'
            ].join('\n')
          }
        ]
      });

      return await interaction.reply({
        embeds: [helpEmbed],
        ephemeral: false
      });
    }

    if (commandName === 'notification') {
      if (interaction.user.id !== OWNER_ID) {
        return await interaction.reply({
          embeds: [
            createBotEmbed({
              title: '❌ Không đủ thẩm quyền',
              description: 'Chỉ Chủ sở hữu Bot (Owner) mới có quyền dùng lệnh này!',
              user: interaction.user,
              locale: userLocale,
              color: COLORS.ERROR
            })
          ],
          ephemeral: true
        });
      }

      const message = interaction.options.getString('message', true).trim();
      await interaction.deferReply({ ephemeral: true });

      const allUsers = await UserModel.find({});
      let successCount = 0;
      let failedCount = 0;

      for (const doc of allUsers) {
        try {
          const user = await client.users.fetch(doc.userId);
          await user.send({
            embeds: [
              createBotEmbed({
                title: '👑 Thông Báo Từ Owner',
                description: message,
                user,
                locale: userLocale,
                color: COLORS.OWNER
              })
            ]
          });
          successCount += 1;
        } catch (_error) {
          failedCount += 1;
        }
      }

      return await interaction.editReply({
        embeds: [
          createBotEmbed({
            title: '📢 Kết quả gửi thông báo',
            user: interaction.user,
            locale: userLocale,
            fields: [
              { name: '✅ Gửi thành công', value: `${successCount} member`, inline: true },
              { name: '❌ Gửi thất bại', value: `${failedCount} member`, inline: true }
            ],
            color: COLORS.SUCCESS
          })
        ]
      });
    }

    if (commandName === 'setadmin') {
      if (interaction.user.id !== OWNER_ID) {
        return await interaction.reply({
          embeds: [
            createBotEmbed({
              title: '❌ Lỗi phân quyền',
              description: 'Chỉ Owner mới có thẩm quyền quản trị danh sách Admin.',
              user: interaction.user,
              locale: userLocale,
              color: COLORS.ERROR
            })
          ],
          ephemeral: true
        });
      }

      const action = interaction.options.getString('action', true);
      const targetUser = interaction.options.getUser('user', true);

      if (action === 'add') {
        await AdminModel.updateOne({ userId: targetUser.id }, { userId: targetUser.id }, { upsert: true });
        return await interaction.reply({
          embeds: [
            createBotEmbed({
              title: '✅ Thêm Admin thành công',
              description: `Đã cấp quyền Admin cho: **${targetUser.tag}**`,
              user: interaction.user,
              locale: userLocale,
              color: COLORS.OWNER
            })
          ],
          ephemeral: true
        });
      } else if (action === 'remove') {
        await AdminModel.deleteOne({ userId: targetUser.id });
        return await interaction.reply({
          embeds: [
            createBotEmbed({
              title: '✅ Thu hồi Admin thành công',
              description: `Đã xóa quyền Admin của: **${targetUser.tag}**`,
              user: interaction.user,
              locale: userLocale,
              color: COLORS.OWNER
            })
          ],
          ephemeral: true
        });
      }
    }

    if (commandName === 'setlinkclone') {
      if (!(await isBotAdmin(interaction.user.id))) {
        return await interaction.reply({
          embeds: [
            createBotEmbed({
              title: '❌ Quyền truy cập bị từ chối',
              description: 'Bạn không có quyền thực hiện thiết lập link.',
              user: interaction.user,
              locale: userLocale,
              color: COLORS.ERROR
            })
          ],
          ephemeral: true
        });
      }

      const category = interaction.options.getString('category').trim();
      const region = interaction.options.getString('region');
      const link = interaction.options.getString('link').trim();
      const status = interaction.options.getString('status');
      const version = interaction.options.getString('version') || 'v1.0';
      const note = interaction.options.getString('note') || 'Không có ghi chú thêm';

      let linkDoc = await LinkModel.findOne({ category });
      if (!linkDoc) linkDoc = new LinkModel({ category, links: { premium: {} } });

      if (!linkDoc.links.premium) linkDoc.links.premium = {};
      linkDoc.links.premium[region] = { url: link, version, note, status };

      await linkDoc.save();

      await interaction.reply({
        embeds: [
          createBotEmbed({
            title: '✅ Thêm/Cập Nhật Link Thành Công',
            fields: [
              { name: 'Mục', value: category, inline: true },
              { name: 'Gói', value: 'PREMIUM', inline: true },
              { name: 'Khu vực', value: region.toUpperCase(), inline: true },
              { name: 'Phiên bản', value: version, inline: true },
              { name: 'Ghi chú', value: note, inline: true },
              { name: 'Link Tải', value: link }
            ],
            color: COLORS.ADMIN
          })
        ],
        ephemeral: true
      });

      const allUsers = await UserModel.find({});
      const notifyEmbed = createBotEmbed({
        title: '🚀 THÔNG BÁO CẬP NHẬT PHIÊN BẢN MỚI',
        fields: [
          { name: '📌 Bản Clone', value: `\`${category}\``, inline: true },
          { name: '📦 Gói dịch vụ', value: '`PREMIUM`', inline: true },
          { name: '🌐 Máy chủ', value: `\`${region.toUpperCase()}\``, inline: true },
          { name: '🏷️ Phiên bản', value: `\`${version}\``, inline: true },
          { name: '📝 Chi tiết cập nhật', value: `\`\`\`${note}\`\`\`` }
        ],
        color: COLORS.SUCCESS
      });

      for (const u of allUsers) {
        try {
          const userObj = await client.users.fetch(u.userId);
          if (userObj) {
            await userObj.send({ content: '🔔 **Hệ thống có bản cập nhật mới!**', embeds: [notifyEmbed] });
          }
        } catch (e) {}
      }
    }

    else if (commandName === 'createkey') {
      if (!(await isBotAdmin(interaction.user.id))) {
        return await interaction.reply({
          embeds: [
            createBotEmbed({
              title: '❌ Từ chối truy cập',
              description: 'Bạn không có thẩm quyền tạo key!',
              user: interaction.user,
              locale: userLocale,
              color: COLORS.ERROR
            })
          ],
          ephemeral: true
        });
      }

      const duration = interaction.options.getString('duration');
      const targetUser = interaction.options.getUser('target_user');
      await interaction.deferReply({ ephemeral: true });
      
      let generatedKey = generateRandomKey();
      while (await KeyModel.findOne({ key: generatedKey })) { 
        generatedKey = generateRandomKey(); 
      }

      const durationMs = getDurationMilliseconds(duration);
      await KeyModel.create({
        key: generatedKey,
        durationMs,
        activatedAt: null,
        expiresAt: null
      });

      const durationText = formatDuration(durationMs);
      let targetUserDetails = 'Không gửi cho member cụ thể';
      let isDirectSent = false;

      if (targetUser) {
        try {
          const fetchedTargetUser = await client.users.fetch(targetUser.id);
          await fetchedTargetUser.send({
            embeds: [
              createBotEmbed({
                title: '🔑 Nhận Mã Key Mới',
                user: fetchedTargetUser,
                locale: userLocale,
                fields: [
                  { name: 'Mã Key', value: `\`\`\`\n${generatedKey}\n\`\`\`` },
                  { name: 'Thời hạn', value: durationText },
                  { name: 'Hướng dẫn', value: `Sử dụng lệnh \`/redeemkey key:${generatedKey}\` để mở khóa bot.` }
                ],
                color: COLORS.MEMBER
              })
            ]
          });
          isDirectSent = true;
          targetUserDetails = `Đã gửi cho ${fetchedTargetUser.tag} (ID:${fetchedTargetUser.id})`;
        } catch (error) {
          targetUserDetails = `Gửi thất bại cho ${targetUser.tag} (ID:${targetUser.id})`;
        }
      }

      await interaction.editReply({
        embeds: [
          createBotEmbed({
            title: '🔑 Tạo Key Thành Công',
            user: interaction.user,
            locale: userLocale,
            fields: [
              { name: 'Mã Key', value: `\`\`\`\n${generatedKey}\n\`\`\``, inline: false },
              { name: 'Thời hạn', value: durationText, inline: true },
              { name: 'Trạng thái DM', value: isDirectSent ? '✅ Đã gửi DM' : (targetUser ? '❌ Lỗi gửi DM' : 'Không gửi'), inline: true }
            ],
            color: COLORS.ADMIN
          })
        ]
      });

      await notifyOwner(
        createBotEmbed({
          title: '🔑 Nhật Ký Tạo Key',
          user: interaction.user,
          locale: userLocale,
          fields: [
            { name: 'Người tạo', value: `${interaction.user.tag} (${interaction.user.id})` },
            { name: 'Key', value: `\`\`\`\n${generatedKey}\n\`\`\`` },
            { name: 'Thời hạn', value: durationText },
            { name: 'Đối tượng nhận', value: targetUserDetails }
          ],
          color: COLORS.ADMIN
        })
      );
    }

    else if (commandName === 'removekey') {
      if (interaction.user.id !== OWNER_ID) {
        return await interaction.reply({
          embeds: [
            createBotEmbed({
              title: '❌ Thất bại',
              description: 'Chỉ Owner mới có quyền thu hồi/xóa key!',
              user: interaction.user,
              locale: userLocale,
              color: COLORS.ERROR
            })
          ],
          ephemeral: true
        });
      }

      const userKey = interaction.options.getString('key', true).trim();
      const keyData = await KeyModel.findOne({ key: userKey });

      if (!keyData) {
        return await interaction.reply({
          embeds: [
            createBotEmbed({
              title: '❌ Không tìm thấy',
              description: `Key \n\`\`\`\n${userKey}\n\`\`\`\nkhông tồn tại trên hệ thống.`,
              user: interaction.user,
              locale: userLocale,
              color: COLORS.ERROR
            })
          ],
          ephemeral: true
        });
      }

      await KeyModel.deleteOne({ key: userKey });

      return await interaction.reply({
        embeds: [
          createBotEmbed({
            title: '✅ Đã Xóa Key',
            description: `Đã xóa vĩnh viễn key chưa sử dụng:\n\`\`\`\n${userKey}\n\`\`\``,
            user: interaction.user,
            locale: userLocale,
            color: COLORS.OWNER
          })
        ],
        ephemeral: true
      });
    }

    else if (commandName === 'redeemkey') {
      const userKey = interaction.options.getString('key').trim();
      const keyData = await KeyModel.findOne({ key: userKey });

      if (!keyData) {
        return await interaction.reply({
          embeds: [
            createBotEmbed({
              title: '❌ Key Không Hợp Lệ',
              description: `Mã key:\n\`\`\`\n${userKey}\n\`\`\`\nkhông tồn tại hoặc đã nhập sai!`,
              user: interaction.user,
              locale: userLocale,
              color: COLORS.ERROR
            })
          ],
          ephemeral: true
        });
      }

      const now = Date.now();
      let currentUserData = await AccessModel.findOne({ userId: interaction.user.id });
      let isExtension = false;
      let newExpiresAt = now;

      if (keyData.durationMs === -1) {
        newExpiresAt = -1;
      } else {
        if (currentUserData && currentUserData.expiresAt > now && currentUserData.expiresAt !== -1) {
          newExpiresAt = currentUserData.expiresAt + keyData.durationMs;
          isExtension = true;
        } else {
          newExpiresAt = now + keyData.durationMs;
        }
      }

      await AccessModel.updateOne(
        { userId: interaction.user.id },
        {
          userId: interaction.user.id,
          expiresAt: newExpiresAt,
          durationMs: keyData.durationMs,
          warned24h: false,
          warned4h: false
        },
        { upsert: true }
      );

      await KeyModel.deleteOne({ key: userKey });

      await interaction.reply({
        embeds: [
          createBotEmbed({
            title: '🎉 Kích Hoạt Thành Công',
            description: `Bạn đã kích hoạt thành công key:\n\`\`\`\n${userKey}\n\`\`\`\nvà mở khóa toàn bộ quyền truy cập!`,
            user: interaction.user,
            locale: userLocale,
            fields: [
              { name: 'Thời hạn hết hạn', value: formatExpiry(newExpiresAt) }
            ],
            color: COLORS.SUCCESS
          })
        ],
        ephemeral: true
      });

      if (isExtension) {
        try {
          await interaction.user.send({
            embeds: [
              createBotEmbed({
                title: '🔄 Thông Báo Gia Hạn',
                description: 'Bạn đã được cộng thêm thời gian sử dụng bot thành công!',
                user: interaction.user,
                locale: userLocale,
                fields: [
                  { name: 'Thời hạn hết hạn mới', value: formatExpiry(newExpiresAt) }
                ],
                color: COLORS.MEMBER
              })
            ]
          });
        } catch (_e) {}
      }

      await notifyOwner(
        createBotEmbed({
          title: '✅ Member Đã Redeem Key',
          user: interaction.user,
          locale: userLocale,
          fields: [
            { name: 'Username', value: interaction.user.tag, inline: true },
            { name: 'ID Member', value: interaction.user.id, inline: true },
            { name: 'Key', value: `\`\`\`\n${userKey}\n\`\`\`` },
            { name: 'Hết hạn', value: formatExpiry(newExpiresAt) }
          ],
          color: COLORS.SUCCESS
        })
      );
    }
  }

  if (interaction.isButton()) {
    const customId = interaction.customId;

    if (customId === 'btn_type_premium') {
      if (!(await getValidAccessKey(interaction.user.id))) {
        return await interaction.reply({
          embeds: [createBotEmbed({
            title: '🔒 Truy Cập Bị Khóa',
            description: 'Bạn chưa kích hoạt key hoặc key đã hết hạn! Dùng `/redeemkey` để kích hoạt.',
            color: COLORS.ERROR
          })],
          ephemeral: true
        });
      }

      const subEmbed = createBotEmbed({
        title: '🌐 HỆ THỐNG CHỌN KHU VỰC ROBLOX',
        description: 'Vui lòng chọn khu vực game của bạn',
        color: COLORS.ADMIN
      });

      const regionRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('btn_reg_premium_global').setLabel('🌍 Global').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('btn_reg_premium_vng').setLabel('🇻🇳 VNG').setStyle(ButtonStyle.Success)
      );

      return await interaction.reply({ embeds: [subEmbed], components: [regionRow], ephemeral: true });
    }

    if (customId.startsWith('btn_reg_')) {
      const [, , type, region] = customId.split('_');

      const allLinks = await LinkModel.find({});
      const filteredLinks = allLinks.filter(item => item.links?.premium?.[region]?.url);

      if (filteredLinks.length === 0) {
        return await interaction.reply({
          embeds: [createBotEmbed({
            title: '❌ Thao Tác Thất Bại',
            description: `Hiện chưa có bản Clone nào khả dụng cho khu vực **${region.toUpperCase()}**!`,
            color: COLORS.ERROR
          })],
          ephemeral: true
        });
      }

      const options = filteredLinks.map(item => {
        const data = item.links.premium[region];
        const vText = data.version || 'v1.0';
        const nText = data.note || 'Không ghi chú';
        return {
          label: `${item.category} [${vText}]`,
          description: `Phiên bản: ${vText} -${nText}`.slice(0, 100),
          value: `${item.category}\vert{}premium\vert{}${region}`
        };
      });

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('select_clone_item')
        .setPlaceholder(`--- Chọn bản Clone (${region.toUpperCase()}) ---`)
        .addOptions(options.slice(0, 25));

      const responseEmbed = createBotEmbed({
        title: `👇 DANH SÁCH BẢN CLONE (${region.toUpperCase()})`,
        description: `Vui lòng chọn phiên bản **${region.toUpperCase()}** bạn muốn tải từ menu bên dưới:`,
        color: COLORS.DEFAULT
      });

      return await interaction.reply({
        embeds: [responseEmbed],
        components: [new ActionRowBuilder().addComponents(selectMenu)],
        ephemeral: true
      });
    }
  }

  if (interaction.isStringSelectMenu()) {
    const { customId } = interaction;

    if (customId === 'select_clone_item') {
      await interaction.deferReply({ ephemeral: true });

      const parts = interaction.values[0].split('|');
      const category = parts[0];
      const region = parts[parts.length - 1];

      if (!(await getValidAccessKey(interaction.user.id))) {
        return await interaction.editReply({
          embeds: [createBotEmbed({
            title: '🔒 Truy Cập Bị Khóa',
            description: 'Key của bạn đã hết hạn!',
            color: COLORS.ERROR
          })]
        });
      }

      const linkDoc = await LinkModel.findOne({ category });
      const itemData = linkDoc?.links?.premium?.[region];

      if (!itemData || !itemData.url) {
        return await interaction.editReply({
          embeds: [createBotEmbed({
            title: '❌ Thao Tác Thất Bại',
            description: 'Link này vừa bị gỡ hoặc không tồn tại!',
            color: COLORS.ERROR
          })]
        });
      }

      const statusMap = {
        active: { text: '🟢 Đang hoạt động', allowDownload: true },
        maintenance: { text: '🟡 Đang bảo trì / Chờ update', allowDownload: false },
        disabled: { text: '🔴 Ngừng hoạt động', allowDownload: false }
      };

      const currentStatus = statusMap[itemData.status || 'active'];

      const resultEmbed = createBotEmbed({
        title: `👑 PHIÊN BẢN PREMIUM: ${category.toUpperCase()} (${region.toUpperCase()})`,
        fields: [
          { name: '📦 Gói dịch vụ', value: '`PREMIUM`', inline: true },
          { name: '🌐 Máy chủ', value: `\`${region.toUpperCase()}\``, inline: true },
          { name: '📌 Phiên bản', value: `\`${itemData.version || 'Mới nhất'}\``, inline: true },
          { name: '📊 Trạng thái', value: `\`${currentStatus.text}\``, inline: false },
          { 
            name: '🔗 Đường dẫn tải xuống', 
            value: currentStatus.allowDownload 
              ? `${itemData.url}`
              : `⚠️ Link tải tạm thời ẩn do bản Clone đang ${currentStatus.text}. Vui lòng chờ Admin cập nhật!`
          },
          { name: '📝 Ghi chú & Tính năng', value: `\`\`\`${itemData.note || 'Không có ghi chú'}\`\`\`` },
          { 
            name: '⚠️ LƯU Ý QUAN TRỌNG', 
            value: '```diff\n- CẤM CHIA SẺ LINK CHO NGƯỜI KHÁC!\n- Nếu phát hiện chia sẻ link hoặc mã tải ra ngoài, Admin sẽ BLOCK tài khoản!\n```' 
          }
        ],
        color: currentStatus.allowDownload ? COLORS.SUCCESS : COLORS.ERROR,
        user: interaction.user
      });

      return await interaction.editReply({ embeds: [resultEmbed] });
    }

    if (customId === 'admin_select_setstatus_item') {
      const [category, region] = interaction.values[0].split('|');

      const statusSelect = new StringSelectMenuBuilder()
        .setCustomId(`admin_change_status_apply|${category}\vert{}${region}`)
        .setPlaceholder(`--- Chọn Trạng Thái Mới Cho ${category} ---`)
        .addOptions([
          { label: '🟢 Hoạt động', value: 'active', description: 'Cho phép người dùng lấy link tải' },
          { label: '🟡 Đang bảo trì / Chờ update', value: 'maintenance', description: 'Tạm ẩn link và báo bảo trì' },
          { label: '🔴 Ngừng hoạt động', value: 'disabled', description: 'Tắt tính năng tải xuống' }
        ]);

      const embed = createBotEmbed({
        title: '⚙️ CHỌN TRẠNG THÁI MỚI',
        description: `Bạn đang đổi trạng thái cho bản **${category}** (${region.toUpperCase()}). Vui lòng chọn trạng thái bên dưới:`,
        color: COLORS.ADMIN
      });

      return await interaction.reply({
        embeds: [embed],
        components: [new ActionRowBuilder().addComponents(statusSelect)],
        ephemeral: true
      });
    }

    if (customId.startsWith('admin_change_status_apply|')) {
      await interaction.deferReply({ ephemeral: true });

      const [, category, region] = customId.split('|');
      const newStatus = interaction.values[0];

      const linkDoc = await LinkModel.findOne({ category });
      if (linkDoc && linkDoc.links?.premium?.[region]) {
        linkDoc.links.premium[region].status = newStatus;
        await linkDoc.save();
      }

      const statusTextMap = { active: '🟢 Hoạt động', maintenance: '🟡 Đang bảo trì', disabled: '🔴 Ngừng hoạt động' };

      return await interaction.editReply({
        embeds: [createBotEmbed({
          title: '⚡ Cập Nhật Trạng Thái Thành Công',
          fields: [
            { name: 'Mục', value: category, inline: true },
            { name: 'Loại', value: `PREMIUM - ${region.toUpperCase()}`, inline: true },
            { name: 'Trạng thái mới', value: `\`${statusTextMap[newStatus]}\``, inline: false }
          ],
          color: COLORS.SUCCESS
        })]
      });
    }

    if (customId === 'admin_select_delete_item') {
      await interaction.deferReply({ ephemeral: true });

      const [category, region] = interaction.values[0].split('|');

      const linkDoc = await LinkModel.findOne({ category });
      if (linkDoc && linkDoc.links?.premium) {
        delete linkDoc.links.premium[region];
        if (Object.keys(linkDoc.links.premium).length === 0) {
          await LinkModel.deleteOne({ category });
        } else {
          await linkDoc.save();
        }
      }

      return await interaction.editReply({
        embeds: [createBotEmbed({
          title: '✅ Xóa Bản Clone Thành Công',
          description: `Đã xóa bản Clone **${category}** ở khu vực **${region.toUpperCase()}** khỏi hệ thống!`,
          color: COLORS.SUCCESS
        })]
      });
    }
  }
});

client.once('ready', () => { 
  console.log(`🤖 Bot ${client.user.tag} đã sẵn sàng hoạt động!`); 
  autoScanAndCleanExpiredKeys();
});

client.login(TOKEN);
