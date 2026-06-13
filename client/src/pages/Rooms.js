import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Tag, Space, Badge, Tabs, Empty, Descriptions, Button, Modal } from 'antd';
import { HomeOutlined, CalendarOutlined, UserOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { getRooms, getBookings } from '../api';

function Rooms() {
  const [rooms, setRooms] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeRoom, setActiveRoom] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [r, b] = await Promise.all([getRooms(), getBookings()]);
      setRooms(r);
      setBookings(b);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getRoomStatus = (room) => {
    if (room.realtime_status === 'maintenance') {
      return { color: 'orange', text: '维护中', icon: '🔧' };
    }
    if (room.realtime_status === 'occupied') {
      return { color: 'red', text: '已占用', icon: '🔴' };
    }
    return { color: 'green', text: '空闲可用', icon: '🟢' };
  };

  const getActiveBooking = (roomId) => {
    return bookings.find(b =>
      b.room_id === roomId &&
      ['active', 'overdue'].includes(b.status) &&
      dayjs(b.check_in_date).isBefore(dayjs().add(1, 'day')) &&
      (!b.actual_check_out || dayjs(b.actual_check_out).isAfter(dayjs()))
    );
  };

  const renderRoomCard = (room) => {
    const status = getRoomStatus(room);
    const booking = getActiveBooking(room.id);

    return (
      <Col xs={24} sm={12} md={8} lg={6} key={room.id}>
        <Card
          hoverable
          loading={loading}
          onClick={() => setActiveRoom({ room, booking })}
          style={{
            borderRadius: 12,
            border: status.color === 'red' ? '2px solid #ff7875' : status.color === 'orange' ? '2px solid #ffc069' : 'none',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            height: '100%'
          }}
          bodyStyle={{ padding: 16 }}
        >
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: 18 }}>
                {room.type === 'cat' ? '🐱' : '🐕'} {room.name}
              </h3>
              <Tag color={status.color} style={{ margin: 0 }}>
                {status.icon} {status.text}
              </Tag>
            </div>

            <div style={{ color: '#666', fontSize: 13 }}>
              {room.description}
            </div>

            <Descriptions size="small" column={2} bordered>
              <Descriptions.Item label="容量">{room.capacity} 只</Descriptions.Item>
              <Descriptions.Item label="类型">{room.type === 'cat' ? '猫房' : '犬舍'}</Descriptions.Item>
            </Descriptions>

            {booking && (
              <div style={{
                background: '#fff1f0',
                padding: 12,
                borderRadius: 8,
                borderLeft: '3px solid #ff4d4f'
              }}>
                <Space direction="vertical" size="small" style={{ width: '100%' }}>
                  <div style={{ fontWeight: 500 }}>
                    <UserOutlined /> {booking.pet_name}
                    {booking.status === 'overdue' && <Tag color="red">超期</Tag>}
                  </div>
                  <div style={{ fontSize: 12, color: '#666' }}>
                    主人: {booking.owner_name} ({booking.owner_phone})
                  </div>
                  <div style={{ fontSize: 12, color: '#666' }}>
                    <CalendarOutlined /> {dayjs(booking.check_in_date).format('MM-DD')} → {dayjs(booking.check_out_date).format('MM-DD')}
                  </div>
                </Space>
              </div>
            )}
          </Space>
        </Card>
      </Col>
    );
  };

  const catRooms = rooms.filter(r => r.type === 'cat');
  const dogRooms = rooms.filter(r => r.type === 'dog');

  return (
    <div>
      <Tabs
        defaultActiveKey="all"
        items={[
          {
            key: 'all',
            label: `全部房间 (${rooms.length})`,
            children: (
              <Row gutter={[16, 16]}>
                {rooms.map(renderRoomCard)}
              </Row>
            )
          },
          {
            key: 'cat',
            label: `🐱 猫房 (${catRooms.length})`,
            children: (
              <Row gutter={[16, 16]}>
                {catRooms.map(renderRoomCard)}
              </Row>
            )
          },
          {
            key: 'dog',
            label: `🐕 犬舍 (${dogRooms.length})`,
            children: (
              <Row gutter={[16, 16]}>
                {dogRooms.map(renderRoomCard)}
              </Row>
            )
          },
          {
            key: 'occupied',
            label: `🔴 已占用 (${rooms.filter(r => r.realtime_status === 'occupied').length})`,
            children: (
              <Row gutter={[16, 16]}>
                {rooms.filter(r => r.realtime_status === 'occupied').map(renderRoomCard)}
              </Row>
            )
          },
          {
            key: 'available',
            label: `🟢 空闲可用 (${rooms.filter(r => r.realtime_status === 'available').length})`,
            children: (
              <Row gutter={[16, 16]}>
                {rooms.filter(r => r.realtime_status === 'available').map(renderRoomCard)}
              </Row>
            )
          }
        ]}
      />

      <Modal
        title={activeRoom ? `${activeRoom.room.type === 'cat' ? '🐱' : '🐕'} ${activeRoom.room.name} 详情` : ''}
        open={!!activeRoom}
        onCancel={() => setActiveRoom(null)}
        footer={[
          <Button key="close" onClick={() => setActiveRoom(null)}>
            关闭
          </Button>
        ]}
        width={600}
      >
        {activeRoom && (
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <Descriptions bordered column={2} title="房间信息">
              <Descriptions.Item label="房间名">{activeRoom.room.name}</Descriptions.Item>
              <Descriptions.Item label="类型">{activeRoom.room.type === 'cat' ? '猫房' : '犬舍'}</Descriptions.Item>
              <Descriptions.Item label="容量">{activeRoom.room.capacity} 只</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={getRoomStatus(activeRoom.room).color}>
                  {getRoomStatus(activeRoom.room).text}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="描述" span={2}>{activeRoom.room.description}</Descriptions.Item>
            </Descriptions>

            {activeRoom.booking ? (
              <Descriptions bordered column={2} title="当前住客">
                <Descriptions.Item label="预约号">{activeRoom.booking.booking_no}</Descriptions.Item>
                <Descriptions.Item label="宠物名">{activeRoom.booking.pet_name}</Descriptions.Item>
                <Descriptions.Item label="品种">{activeRoom.booking.breed || '-'}</Descriptions.Item>
                <Descriptions.Item label="主人">
                  {activeRoom.booking.owner_name} ({activeRoom.booking.owner_phone})
                </Descriptions.Item>
                <Descriptions.Item label="入住日期">{dayjs(activeRoom.booking.check_in_date).format('YYYY-MM-DD')}</Descriptions.Item>
                <Descriptions.Item label="预计离店">
                  {dayjs(activeRoom.booking.check_out_date).format('YYYY-MM-DD')}
                  {activeRoom.booking.status === 'overdue' && <Tag color="red">已超期</Tag>}
                </Descriptions.Item>
                <Descriptions.Item label="喂药">{activeRoom.booking.medication || '无'}</Descriptions.Item>
                <Descriptions.Item label="洗护服务">
                  <Tag color={activeRoom.booking.grooming ? 'green' : 'default'}>
                    {activeRoom.booking.grooming ? '已预约' : '未预约'}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="接送服务">
                  <Tag color={activeRoom.booking.pickup_service ? 'green' : 'default'}>
                    {activeRoom.booking.pickup_service ? '已预约' : '未预约'}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="预估费用">¥{activeRoom.booking.total_price}</Descriptions.Item>
                <Descriptions.Item label="备注" span={2}>{activeRoom.booking.notes || '-'}</Descriptions.Item>
              </Descriptions>
            ) : (
              <Empty description="当前无人入住" />
            )}
          </Space>
        )}
      </Modal>
    </div>
  );
}

export default Rooms;
